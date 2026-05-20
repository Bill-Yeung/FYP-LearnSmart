import asyncio
import json
import logging
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.core.database import postgres_db
from app.services.ai.provider import AIProvider, SessionContext

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an elite educational psychologist and a specialist in gamified learning and mystery-solving cognitive analysis. 
Your task is to evaluate a specific "knowledge point" or "puzzle segment" and analyze its weighted impact across 6 core cognitive dimensions.

[Cognitive Dimension Definitions]:
1. memory: Assesses the ability to recall timelines, character relationships, specific crime scene details, and terminology.
2. understanding: Assesses the comprehension of character motives, underlying background lore, and complex definitions.
3. logic: Assesses rigorous deductive reasoning, proof by contradiction, identifying logical fallacies, and verifying alibis.
4. association: Assesses the ability to connect scattered clues across different scenes, map cross-disciplinary knowledge, and find hidden links.
5. application: Assesses the practical execution of known rules (e.g., physical laws, specific tricks, legal principles) to solve the mystery.
6. creativity: Assesses lateral thinking, breaking conventional mindsets, and uncovering narrative tricks.

[Scoring Rules]:
- Score each of the 6 dimensions from 0.0 to 1.0 (keep two decimal places).
- One or multiple dimensions can be the primary focus (score >= 0.7).
- If a dimension is highly irrelevant, score it 0.0.
- The sum of the scores does NOT need to equal 1.0 (a task can heavily test multiple skills simultaneously).

[Output Constraints]:
You must output strictly valid JSON ONLY. Do not wrap the JSON in markdown code blocks. Do not output any conversational text.
You must strictly follow this JSON Schema:
{
  "primary_dimension": "string (the exact English name of the highest scoring dimension)",
  "dimension_scores": {
    "memory": float,
    "understanding": float,
    "logic": float,
    "association": float,
    "application": float,
    "creativity": float
  },
  "tags": ["string (Extract 3 to 5 specific skill or puzzle-type tags, e.g., 'timeline reconstruction', 'alibi verification')"],
  "confidence_score": float (your confidence in this evaluation, between 0.0 and 1.0)
}"""

USER_PROMPT_TEMPLATE = """Please analyze the following knowledge point/puzzle:

[Module/Script Name]: {module_name}
[Knowledge Title]: {knowledge_title}
[Content/Description]: {knowledge_content_or_summary}

Provide the corresponding JSON output."""

async def process_knowledge_point(pool, ai_provider: AIProvider, kp: dict) -> bool:
    content = kp.get("content") or kp.get("summary") or kp.get("title")
    if not content:
        return False

    prompt = USER_PROMPT_TEMPLATE.format(
        module_name=kp.get("module_key", "Unknown Module"),
        knowledge_title=kp.get("title", "Unknown Title"),
        knowledge_content_or_summary=content
    )
    
    session = SessionContext(system_prompt=SYSTEM_PROMPT)
    
    try:
        response = await ai_provider.generate(
            prompt=prompt,
            session=session,
            temperature=0.1,
            json_mode=True
        )
        
        # Clean response in case it's wrapped in markdown
        if response.startswith("```json"):
            response = response[7:]
        if response.endswith("```"):
            response = response[:-3]
            
        data = json.loads(response.strip())
        
        primary_dimension = data.get("primary_dimension", "logic")
        dimension_scores = data.get("dimension_scores", {})
        tags = data.get("tags", [])
        confidence_score = float(data.get("confidence_score", 1.0))
        
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO knowledge_cognitive_profiles
                (script_id, item_id, item_type, primary_dimension, dimension_scores, tags, confidence_score, evaluated_by)
                VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)
                ON CONFLICT (script_id, item_id) DO UPDATE SET
                    primary_dimension = EXCLUDED.primary_dimension,
                    dimension_scores = EXCLUDED.dimension_scores,
                    tags = EXCLUDED.tags,
                    confidence_score = EXCLUDED.confidence_score,
                    updated_at = CURRENT_TIMESTAMP
                """,
                kp["script_id"],
                kp["item_id"],
                kp["item_type"],
                primary_dimension,
                json.dumps(dimension_scores),
                json.dumps(tags),
                confidence_score,
                "llm"
            )
        logger.info(f"Processed KP: {kp['item_id']} - Primary: {primary_dimension}")
        return True
    except Exception as e:
        logger.error(f"Failed to process KP {kp['item_id']}: {e}")
        return False

async def main():
    logger.info("Initializing database connection...")
    await postgres_db.connect()
    pool = postgres_db.pool
    
    ai_provider = AIProvider()
    
    knowledge_points_to_process = []

    async with pool.acquire() as conn:
        scripts = await conn.fetch("SELECT id, title, outline_json FROM scripts WHERE status != 'draft'")
        
        for script in scripts:
            script_id = script["id"]
            script_title = script["title"] or "Unknown Script"
            outline = script["outline_json"]
            
            if isinstance(outline, str):
                try:
                    outline = json.loads(outline)
                except Exception:
                    continue
            
            if not isinstance(outline, dict):
                continue
                
            knowledge_base = outline.get("knowledgeBase", [])
            for kb in knowledge_base:
                item_id = kb.get("knowledgeId")
                if not item_id:
                    continue
                
                exists = await conn.fetchval(
                    "SELECT id FROM knowledge_cognitive_profiles WHERE script_id = $1 AND item_id = $2",
                    script_id, item_id
                )
                
                if not exists:
                    knowledge_points_to_process.append({
                        "script_id": script_id,
                        "item_id": item_id,
                        "item_type": "concept",
                        "module_key": script_title,
                        "title": kb.get("name", "Unknown Concept"),
                        "content": kb.get("description", "")
                    })
        
    logger.info(f"Found {len(knowledge_points_to_process)} knowledge points to profile from scripts.")
    
    success_count = 0
    for kp in knowledge_points_to_process:
        success = await process_knowledge_point(pool, ai_provider, kp)
        if success:
            success_count += 1
            
    logger.info(f"Successfully processed {success_count}/{len(knowledge_points_to_process)} knowledge points.")
    await postgres_db.disconnect()

if __name__ == "__main__":
    asyncio.run(main())
