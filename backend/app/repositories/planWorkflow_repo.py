import json
import logging
import uuid
from datetime import date, timedelta
from typing import Any, Dict, List, Optional

import asyncpg

logger = logging.getLogger(__name__)

_plan_tasks_by_user: Dict[str, List[Dict[str, Any]]] = {}

class PlanWorkflowRepository:
    def __init__(self, db: asyncpg.Connection):
        self.db = db

    async def _resolve_topic_title(self, k_id: str, s_id: str) -> str:
        script_name = ""
        doc_name = ""
        concept_name = ""
        module_name = ""
        
        if s_id:
            try:
                s_uuid = uuid.UUID(str(s_id))
                row = await self.db.fetchrow("""
                    SELECT s.title as script_title, s.module_name as script_module_name, s.outline_json, p.document_name 
                    FROM scripts s
                    LEFT JOIN parsed_documents p ON s.document_hash = p.document_hash
                    WHERE s.id = $1
                """, s_uuid)
                if row:
                    if row.get('script_title'):
                        script_name = row['script_title']
                    doc_name = script_name 
                    
                    if row.get('document_name'):
                        doc_name = row['document_name']
                    
                    if row.get('script_module_name') and row['script_module_name'] != 'all concepts':
                        module_name = row['script_module_name']
                    
                    if k_id and row.get('outline_json'):
                        import json
                        try:
                            outline = json.loads(row['outline_json']) if isinstance(row['outline_json'], str) else row['outline_json']
                            for k in outline.get('knowledgeBase', []):
                                if k.get('knowledgeId') == k_id and k.get('name'):
                                    concept_name = k['name']
                                    break
                        except Exception:
                            pass
            except Exception:
                pass
        
        if k_id and not concept_name:
            try:
                k_uuid = uuid.UUID(str(k_id))
                row = await self.db.fetchrow("SELECT title, module_key FROM knowledge_points WHERE id = $1", k_uuid)
                if row:
                    if row.get('title'):
                        concept_name = row['title']
                    if not module_name and row.get('module_key') and row['module_key'] != 'all concepts':
                        module_name = row['module_key']
            except Exception:
                pass
        
        title_parts = []
        if module_name:
            title_parts.append(module_name)
            
        if concept_name:
            title_parts.append(concept_name)
        
            
        if title_parts:
            return " / ".join(title_parts)
            
        return "Daily Focus"

    async def get_user_learn_later(self, user_id: str) -> List[Dict[str, Any]]:
        query = """
            SELECT ull.knowledge_id, ull.script_id, ull.is_learned, ull.personal_notes, ull.time_spent_minutes, ull.mastery_level,
                   ull.added_at, ull.learned_at, ull.updated_at, ull.quiz_attempts, ull.ai_content_viewed,
                   kcp.primary_dimension
            FROM user_learn_later ull
            LEFT JOIN knowledge_cognitive_profiles kcp
                   ON ull.knowledge_id = kcp.item_id AND ull.script_id = kcp.script_id
            WHERE ull.user_id = $1
            ORDER BY ull.added_at DESC
        """
        rows = await self.db.fetch(query, user_id)
        return [dict(r) for r in rows] if rows else []

    async def get_user_progress_stats(self, user_id: str) -> Dict[str, Any]:
        query = """
            SELECT COUNT(*) AS total_scripts,
                   SUM(
                       CASE
                           WHEN jsonb_typeof(completed_scenes) = 'array' THEN jsonb_array_length(completed_scenes)
                           ELSE 0
                       END
                   ) AS completed_scenes,
                   SUM(
                       CASE
                           WHEN jsonb_typeof(answered_questions) = 'array' THEN jsonb_array_length(answered_questions)
                           ELSE 0
                       END
                   ) AS answered_questions
            FROM user_progress
            WHERE user_id = $1
        """
        row = await self.db.fetchrow(query, user_id)
        return dict(row) if row else {}

    async def upsert_daily_task(self, user_id: str, task: Dict[str, Any]) -> Dict[str, Any]:
        user_tasks = _plan_tasks_by_user.setdefault(user_id, [])
        task_id = task.get("id") or str(uuid.uuid4())
        existing = next((t for t in user_tasks if t["id"] == task_id), None)
        if existing:
            existing.update(task)
            task = existing
        else:
            task = {
                "id": task_id,
                "userId": user_id,
                "title": task.get("title", "Untitled task"),
                "type": task.get("type", "memory"),
                "status": task.get("status", "pending"),
                "durationMinutes": task.get("durationMinutes", 20),
                "knowledgeId": task.get("knowledgeId"),
                "scriptId": task.get("scriptId"),
                "tags": task.get("tags", []),
            }
            user_tasks.append(task)
        return task

    async def list_user_daily_plan_tasks(self, user_id: str) -> List[Dict[str, Any]]:

        return list(_plan_tasks_by_user.get(user_id, []))

    async def delete_daily_task(self, user_id: str, task_id: str) -> bool:
        user_tasks = _plan_tasks_by_user.get(user_id, [])
        for i, t in enumerate(user_tasks):
            if t["id"] == task_id:
                del user_tasks[i]
                return True
        return False

    async def get_user_answer_stats(self, user_id: str) -> Dict[str, Dict[str, Any]]:

        query = """
            SELECT
                knowledge_id,
                COUNT(*) AS attempts,
                SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) AS correct,
                MAX(timestamp) AS last_answered,
                MAX(CASE WHEN NOT is_correct THEN timestamp ELSE NULL END) AS last_incorrect
            FROM user_answers
            WHERE user_id = $1
            GROUP BY knowledge_id
        """
        rows = await self.db.fetch(query, user_id)
        stats: Dict[str, Dict[str, Any]] = {}
        for row in rows:
            row_dict = dict(row)
            row_dict['attempts'] = int(row_dict.get('attempts', 0))
            row_dict['correct'] = int(row_dict.get('correct', 0))
            stats[row_dict.get('knowledge_id')] = row_dict
        return stats


    async def _get_dashboard_analytics(self, user_id: str):
        import datetime
        from datetime import date, timedelta
        
        query_heatmap = '''
            SELECT activity_date, SUM(minutes) as estimated_minutes FROM (
                SELECT DATE(timestamp) as activity_date, COUNT(*) * 3 as minutes 
                FROM user_answers 
                WHERE user_id = $1 AND timestamp >= CURRENT_DATE - INTERVAL '90 days' 
                GROUP BY DATE(timestamp)
                UNION ALL
                SELECT DATE(updated_at) as activity_date, COUNT(*) * 5 as minutes
                FROM user_learn_later
                WHERE user_id = $1 AND updated_at >= CURRENT_DATE - INTERVAL '90 days'
                GROUP BY DATE(updated_at)
                UNION ALL
                SELECT DATE(updated_at) as activity_date, COUNT(*) * 8 as minutes
                FROM user_progress
                WHERE user_id = $1 AND updated_at >= CURRENT_DATE - INTERVAL '90 days'
                GROUP BY DATE(updated_at)
            ) combined
            GROUP BY activity_date
            ORDER BY activity_date ASC
        '''
        heatmap_rows = await self.db.fetch(query_heatmap, user_id)
        heatmap_map = {str(row['activity_date']): row['estimated_minutes'] for row in heatmap_rows}
        
        heatmap_data = []
        today_iso = date.today().isoformat()
        for i in range(90):
            d = (date.today() - timedelta(days=89 - i)).isoformat()
            heatmap_data.append({"date": d, "minutes": int(heatmap_map.get(d, 0))}) 
        query_recent_scripts = '''
            SELECT up.updated_at, up.completed_scenes, s.title, s.module_name, pd.document_name
            FROM user_progress up
            JOIN scripts s ON up.script_id = s.id
            LEFT JOIN parsed_documents pd ON s.document_hash = pd.document_hash
            WHERE up.user_id = $1
            ORDER BY up.updated_at DESC
            LIMIT 3
        '''
        recent_scripts = await self.db.fetch(query_recent_scripts, user_id)
        
        query_recent_knowledge = '''
            SELECT ull.updated_at, ull.knowledge_id, ull.script_id, ull.mastery_level
            FROM user_learn_later ull
            WHERE ull.user_id = $1 AND ull.mastery_level IN ('mastered', 'proficient')
            ORDER BY ull.updated_at DESC
            LIMIT 3
        '''
        recent_knowledge = await self.db.fetch(query_recent_knowledge, user_id)
        
        activities = []
        def format_time(dt):
            if not dt: return "Recently"
            if dt.date() == date.today(): return f"Today {dt.strftime('%H:%M')}"
            if dt.date() == date.today() - timedelta(days=1): return f"Yesterday {dt.strftime('%H:%M')}"
            return dt.strftime("%b %d, %H:%M")

        for r in recent_scripts:
            scenes = r.get('completed_scenes')
            scene_count = len(scenes) if isinstance(scenes, list) else 0
            
            doc_name = r.get('document_name') or r.get('title') or "Unknown Document"
            mod_name = r.get('module_name')
            if mod_name and mod_name.lower() != 'all concepts':
                display_title = f"{doc_name} - {mod_name}"
            else:
                display_title = doc_name
                
            activities.append({
                "dt": r['updated_at'],
                "time": format_time(r['updated_at']),
                "title": f"Explored '{display_title}'",
                "delta": f"Resolved {scene_count} scenes",
                "type": "logic"
            })
            
        for r in recent_knowledge:

            resolved_title = await self._resolve_topic_title(r['knowledge_id'], r['script_id'])
            activities.append({
                "dt": r['updated_at'],
                "time": format_time(r['updated_at']),
                "title": f"Studied concept: {resolved_title}",
                "delta": f"Level up: {r['mastery_level'].capitalize()}",
                "type": "memory"
            })
            
        activities.sort(key=lambda x: x['dt'] if x['dt'] else datetime.datetime.min, reverse=True)
        recent_data = activities[:5]
        
        for a in recent_data:
            a.pop('dt', None)
            
        return heatmap_data, recent_data

    async def _calculate_cognitive_radar(self, user_id: str) -> Dict[str, int]:

        query = """
            SELECT cp.dimension_scores, ull.mastery_level
            FROM user_learn_later ull
            JOIN knowledge_cognitive_profiles cp 
              ON ull.knowledge_id = cp.item_id AND ull.script_id = cp.script_id
            WHERE ull.user_id = $1
        """
        rows = await self.db.fetch(query, user_id)
        
        mastery_weights = {
            "mastered": 1.0, 
            "proficient": 0.8, 
            "familiar": 0.4, 
            "unfamiliar": 0.0
        }
        
        xp = {
            "memory": 0.0, "understanding": 0.0, "logic": 0.0, 
            "association": 0.0, "application": 0.0, "creativity": 0.0
        }
        
        for r in rows:
            m_level = r.get("mastery_level") or "unfamiliar"
            weight = mastery_weights.get(m_level.lower(), 0.0)
            
            scores = r.get("dimension_scores")
            if not scores:
                continue
                
            if isinstance(scores, str):
                import json
                try:
                    scores = json.loads(scores)
                except Exception:
                    scores = {}
                    
            for dim in xp.keys():
                try:
                    val = float(scores.get(dim, 0))
                    xp[dim] += (val * weight)
                except (ValueError, TypeError):
                    pass

        import math

        SCALING_FACTOR = 100.0  
        radar = {}
        for dim, val in xp.items():
            if val == 0:
                radar[dim] = 10
            else:
                score = 100.0 * (1.0 - math.exp(-val / SCALING_FACTOR))
                radar[dim] = max(15, min(100, int(score)))
                
        return radar

    async def get_plan_summary(self, user_id: str) -> Dict[str, Any]:
        learn_later = await self.get_user_learn_later(user_id)
        progress = await self.get_user_progress_stats(user_id)

        mastered = sum(1 for x in learn_later if x.get("mastery_level") == "mastered")
        proficient = sum(1 for x in learn_later if x.get("mastery_level") == "proficient")
        familiar = sum(1 for x in learn_later if x.get("mastery_level") == "familiar")
        unfamiliar = sum(1 for x in learn_later if x.get("mastery_level") in (None, "unfamiliar"))
        total_tasks = len(learn_later)
        completed_tasks = sum(1 for x in learn_later if x.get("is_learned"))

        today = date.today()
        week_template = []
        for i in range(7):
            current_day = today + timedelta(days=i)
            d = current_day.strftime("%a")
            daily_tasks = [x for idx, x in enumerate(learn_later) if idx % 7 == i]
            blocks = len(daily_tasks)
            if blocks == 0:
                focus = "Rest / optional"
            else:
                themes = []
                for t in daily_tasks:
                    k_id = t.get("knowledge_id")
                    s_id = t.get("script_id")
                    if k_id:
                        title = await self._resolve_topic_title(k_id, s_id)
                        if title not in themes:
                            themes.append(title)

                focus = f"Review {len(themes)} topics" if len(themes) > 0 else "General practice"
                if len(themes) > 0:
                    first_theme = themes[0]
                    if len(first_theme) > 25:
                        first_theme = first_theme[:22] + "..."
                    focus = f"Focus on {first_theme}"
                    if len(themes) > 1:
                        focus += " and others"

            week_template.append({
                "day": d,
                "date": current_day.isoformat(),
                "focus": focus,
                "blocks": blocks
            })

        ability_scores = await self._calculate_cognitive_radar(user_id)

        dailyStudyHeatmap, recentActivities = await self._get_dashboard_analytics(user_id)

        total_points = len(learn_later)
        learned_points = sum(1 for x in learn_later if x.get("is_learned", False) or x.get("mastery_level") == "mastered")
        progress_val = learned_points / total_points if total_points > 0 else 0
        
        sorted_abilities = sorted(ability_scores.items(), key=lambda x: x[1]) if ability_scores else []
        weakest_dim = sorted_abilities[0][0].capitalize() if sorted_abilities else "Memory"
        strongest_dim = sorted_abilities[-1][0].capitalize() if sorted_abilities else "Logic"
        
        long_term_goals = [
            {
                "id": 1,
                "label": f"Clear backlog of {total_points} pending concepts",
                "horizon": "2-weeks",
                "progress": progress_val
            },
            {
                "id": 2,
                "label": f"Improve {weakest_dim} ability beyond {sorted_abilities[0][1] if sorted_abilities else 20}%",
                "horizon": "1-month",
                "progress": (sorted_abilities[0][1] / 100.0) if sorted_abilities else 0.2
            }
        ]

        ai_plan = {
            "basedOn": "Your recent active playthrough logs & skill radar",
            "strengths": [
                f"Outstanding performance in {strongest_dim} ({sorted_abilities[-1][1] if sorted_abilities else 0})",
                f"Mastered {mastered} concepts in total"
            ],
            "improvements": [
                f"{weakest_dim} is lagging behind other abilities ({sorted_abilities[0][1] if sorted_abilities else 0})",
                f"You have {unfamiliar} unfamiliar concepts pending in backlog"
            ],
            "actions": [
                f"Complete at least 2 daily tasks targeting {weakest_dim}.",
                "Re-play a recently failed scenario to convert 'Unfamiliar' concepts to 'Familiar'."
            ],
            "predictive_insight": f"If you keep this pace, {weakest_dim} is projected to improve significantly next week."
        }

        return {
            "totalStudyMinutes": dailyStudyHeatmap[-1]["minutes"] if dailyStudyHeatmap else 0,
            "totalTasks": total_tasks,
            "completedTasks": completed_tasks,
            "learnLaterCount": total_tasks,
            "masteryDistribution": {
                "unfamiliar": unfamiliar,
                "familiar": familiar,
                "proficient": proficient,
                "mastered": mastered,
            },
            "missedConcepts": [
                {"knowledgeId": x.get("knowledge_id"), "points": int(x.get("time_spent_minutes") or 0)}
                for x in learn_later if not x.get("is_learned")
            ][:8],
            "recommendations": [
                "Complete your Learn Later tasks from the weakest concepts first",
                "Do one short script-review block after each 25-min focus session",
            ],
            "longTermGoals": long_term_goals,
            "weekTemplate": week_template,
            "aiPlan": ai_plan,
            "abilityScores": ability_scores,
            "dailyStudyHeatmap": dailyStudyHeatmap,
            "recentActivities": recentActivities,
            **progress,
        }

    async def resolve_topic_title(self, k_id: str, s_id: str) -> str:
        return await self._resolve_topic_title(k_id, s_id)

    async def get_weekly_plan_snapshot(self, user_id: str, target_date: date) -> Optional[Dict[str, Any]]:
        query = """
            SELECT id, start_date, week_template, created_at, updated_at
            FROM weekly_plan_snapshot
            WHERE user_id = $1
              AND start_date <= $2
              AND start_date + INTERVAL '6 days' >= $2
            ORDER BY start_date DESC
            LIMIT 1
        """
        row = await self.db.fetchrow(query, user_id, target_date)
        if not row:
            return None
        row_dict = dict(row)
        week_template = row_dict.get("week_template")
        if isinstance(week_template, str):
            try:
                row_dict["week_template"] = json.loads(week_template)
            except Exception:
                row_dict["week_template"] = []
        return row_dict

    async def save_weekly_plan_snapshot(self, user_id: str, start_date: date, week_template: List[Dict[str, Any]]) -> Dict[str, Any]:
        query = """
            INSERT INTO weekly_plan_snapshot (user_id, start_date, week_template)
            VALUES ($1, $2, $3::jsonb)
            ON CONFLICT (user_id)
            DO UPDATE SET start_date = EXCLUDED.start_date,
                          week_template = EXCLUDED.week_template,
                          updated_at = CURRENT_TIMESTAMP
            RETURNING id, user_id, start_date, week_template, created_at, updated_at
        """
        row = await self.db.fetchrow(query, user_id, start_date, json.dumps(week_template))
        return dict(row)

    async def get_weekly_plan_snapshot_by_user(self, user_id: str) -> Optional[Dict[str, Any]]:
        query = """
            SELECT id, start_date, week_template, created_at, updated_at
            FROM weekly_plan_snapshot
            WHERE user_id = $1
            ORDER BY updated_at DESC
            LIMIT 1
        """
        row = await self.db.fetchrow(query, user_id)
        if not row:
            return None
        row_dict = dict(row)
        week_template = row_dict.get("week_template")
        if isinstance(week_template, str):
            try:
                row_dict["week_template"] = json.loads(week_template)
            except Exception:
                row_dict["week_template"] = []
        return row_dict
