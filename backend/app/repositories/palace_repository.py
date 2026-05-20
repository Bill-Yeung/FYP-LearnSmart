from typing import Dict, Any, List, Optional
from uuid import UUID
from datetime import datetime, timezone
import math

class PalaceRepository:

    def __init__(self, db):
        self.db = db

    async def create_palace(self, user_id: str, data: dict) -> Dict[str, Any]:

        skybox_image_url = data.get("skybox_image_url")
        skybox_type = "uploaded" if skybox_image_url else data.get("skybox_type", "preset")

        row = await self.db.fetchrow(
            """
            INSERT INTO memory_palaces
                (user_id, name, description, mode, skybox_type, skybox_preset, skybox_image_path)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
            """,
            user_id,
            data["name"],
            data.get("description"),
            data.get("mode", "vr"),
            skybox_type,
            data.get("skybox_preset"),
            skybox_image_url,
        )
        return dict(row)

    async def list_palaces(self, user_id: str, mode: str | None = None) -> List[Dict[str, Any]]:
        if mode:
            rows = await self.db.fetch(
                """
                SELECT * FROM memory_palaces
                WHERE user_id = $1 AND is_active = TRUE AND mode = $2
                ORDER BY last_opened_at DESC NULLS LAST, updated_at DESC
                """,
                user_id, mode,
            )
        else:
            rows = await self.db.fetch(
                """
                SELECT * FROM memory_palaces
                WHERE user_id = $1 AND is_active = TRUE
                ORDER BY last_opened_at DESC NULLS LAST, updated_at DESC
                """,
                user_id,
            )
        return [dict(r) for r in rows]

    async def get_palace(self, palace_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        row = await self.db.fetchrow(
            "SELECT * FROM memory_palaces WHERE id = $1 AND user_id = $2",
            palace_id,
            user_id,
        )
        return dict(row) if row else None

    async def update_palace(self, palace_id: str, user_id: str, data: dict) -> Optional[Dict[str, Any]]:
        sets = []
        vals = []
        idx = 3

        for key in ("name", "description", "mode", "skybox_type", "skybox_preset", "skybox_image_path"):
            if key in data and data[key] is not None:
                sets.append(f"{key} = ${idx}")
                vals.append(data[key])
                idx += 1

        if not sets:
            return await self.get_palace(palace_id, user_id)

        sets.append("updated_at = NOW()")
        query = f"UPDATE memory_palaces SET {', '.join(sets)} WHERE id = $1 AND user_id = $2 RETURNING *"
        row = await self.db.fetchrow(query, palace_id, user_id, *vals)
        return dict(row) if row else None

    async def delete_palace(self, palace_id: str, user_id: str) -> bool:
        result = await self.db.execute(
            "UPDATE memory_palaces SET is_active = FALSE, updated_at = NOW() WHERE id = $1 AND user_id = $2",
            palace_id,
            user_id,
        )
        return result == "UPDATE 1"

    async def update_skybox_path(self, palace_id: str, user_id: str, path: str) -> Optional[Dict[str, Any]]:
        row = await self.db.fetchrow(
            """
            UPDATE memory_palaces
            SET skybox_image_path = $3, skybox_type = 'uploaded', updated_at = NOW()
            WHERE id = $1 AND user_id = $2
            RETURNING *
            """,
            palace_id,
            user_id,
            path,
        )
        return dict(row) if row else None

    async def touch_palace(self, palace_id: str, user_id: str) -> Optional[Dict[str, Any]]:

        row = await self.db.fetchrow(
            """
            UPDATE memory_palaces
            SET last_opened_at = NOW(), updated_at = NOW()
            WHERE id = $1 AND user_id = $2
            RETURNING *
            """,
            palace_id, user_id,
        )
        return dict(row) if row else None

    async def seed_demo_palaces(self, user_id: str) -> List[Dict[str, Any]]:
      
        existing = await self.list_palaces(user_id)

        if existing:
            has_items = False
            for palace in existing:
                items = await self.list_items(str(palace["id"]))
                if items:
                    has_items = True
                    break
            if has_items:
                return existing
            return await self._seed_items_into_palaces(existing, user_id)

        created = []

        vr_row = await self.db.fetchrow(
            """
            INSERT INTO memory_palaces (user_id, name, description, mode, skybox_type, skybox_preset)
            VALUES ($1, 'History Garden',
                    'Walk through key moments in World History — from Ancient Greece to the Space Age. Each object represents a pivotal event with dates, figures, and facts to memorize.',
                    'vr', 'preset', 'garden')
            RETURNING *
            """,
            user_id,
        )
        created.append(dict(vr_row))

        ar_row = await self.db.fetchrow(
            """
            INSERT INTO memory_palaces (user_id, name, description, mode, skybox_type, skybox_preset)
            VALUES ($1, 'Science Study Room',
                    'Place key scientific discoveries around your room. Each object anchors a breakthrough — Newton''s laws, DNA, electricity, and more.',
                    'ar', 'preset', NULL)
            RETURNING *
            """,
            user_id,
        )
        created.append(dict(ar_row))

        await self._seed_items_into_palaces(created, user_id)
        return created

    def _history_garden_items(self) -> list:

        return [
            {
                "model": "marble_bust_01",
                "label": "Ancient Greek Democracy",
                "text": (
                    "508 BC — Cleisthenes introduced demokratia in Athens, the world's first democracy. "
                    "Citizens (free adult males, ~30,000 of 250,000 residents) voted directly on laws in the Ecclesia assembly. "
                    "The Council of 500 (Boule) was chosen by lottery. Pericles (461–429 BC) expanded democratic participation "
                    "and funded the Parthenon. This system lasted ~185 years until Macedonian conquest in 322 BC."
                ),
                "position": (-1.5, 1.2, -2.0),
            },
            {
                "model": "chess_set",
                "label": "Fall of the Roman Empire",
                "text": (
                    "476 AD — The Western Roman Empire fell when Germanic chieftain Odoacer deposed the last emperor, "
                    "Romulus Augustulus (age 16). The Empire had split into East/West in 285 AD under Diocletian. "
                    "Key factors: economic crisis, military overextension across 2.5 million sq miles, "
                    "barbarian invasions, and political instability (26 emperors in 50 years during the Crisis of the 3rd Century). "
                    "The Eastern (Byzantine) Empire survived until 1453 AD."
                ),
                "position": (0.3, 0.6, -1.5),
            },
            {
                "model": "treasure_chest",
                "label": "Age of Exploration",
                "text": (
                    "1492 — Columbus reached the Americas with 3 ships (Niña, Pinta, Santa María) and 90 crew. "
                    "Vasco da Gama reached India in 1498 via the Cape of Good Hope (voyage: 23,000 km). "
                    "Magellan's crew completed the first circumnavigation in 1522 (started 1519 with 270 men, only 18 returned). "
                    "The Columbian Exchange transferred crops (potatoes, tomatoes, maize to Europe; wheat, horses to Americas) "
                    "and diseases that killed ~90% of Indigenous populations."
                ),
                "position": (2.0, 0.4, -0.8),
            },
            {
                "model": "cannon_01",
                "label": "French Revolution",
                "text": (
                    "1789–1799 — Storming of the Bastille on July 14, 1789 (only 7 prisoners found inside). "
                    "Causes: national debt of 4 billion livres, bread prices doubled, Estates-General deadlock. "
                    "Declaration of the Rights of Man (Aug 26, 1789) proclaimed liberty, equality, property rights. "
                    "Reign of Terror (1793–94): Robespierre's Committee executed ~17,000 by guillotine. "
                    "Napoleon Bonaparte seized power in 1799 coup, crowned Emperor in 1804."
                ),
                "position": (-2.2, 0.5, 0.5), 
            },
            {
                "model": "vintage_grandfather_clock_01",
                "label": "Industrial Revolution",
                "text": (
                    "1760–1840 — Began in Britain. James Watt improved the steam engine in 1769 (3× more efficient). "
                    "Cotton production increased 800% between 1770–1800. Britain's urban population went from 20% to 50% by 1850. "
                    "First railway: Stockton–Darlington (1825), 25 mph. Child labor was rampant: 1/3 of factory workers were under 18. "
                    "Factory Act of 1833 banned children under 9 from textile mills. "
                    "World GDP per capita doubled from $615 to $1,250 (1990 dollars) between 1750–1900."
                ),
                "position": (1.0, 0.8, 1.8), 
            },
            {
                "model": "book_encyclopedia_set_01",
                "label": "World War II Key Dates",
                "text": (
                    "1939–1945 — Deadliest conflict: 70–85 million deaths (3% of world population). "
                    "Sept 1, 1939: Germany invades Poland. June 6, 1944: D-Day, 156,000 Allied troops land at Normandy. "
                    "Aug 6, 1945: Atomic bomb on Hiroshima (80,000 instant deaths, 'Little Boy', 15 kilotons). "
                    "Aug 9: Nagasaki ('Fat Man', 40,000 deaths). Sept 2, 1945: Japan surrenders on USS Missouri. "
                    "The Holocaust killed 6 million Jews — 2/3 of Europe's Jewish population. "
                    "The war cost $1.3 trillion (1945 dollars, ~$20 trillion today)."
                ),
                "position": (-0.5, 1.4, -3.0), 
            },
        ]

    def _science_study_room_items(self) -> list:

        return [
            {
                "model": "food_apple_01",
                "label": "Newton's Laws of Motion",
                "text": (
                    "1687 — Isaac Newton published Principia Mathematica with 3 laws: "
                    "1st: An object stays at rest or moves at constant velocity unless acted on by a force (inertia). "
                    "2nd: F = ma — force equals mass times acceleration. A 1 kg object accelerating at 1 m/s² needs 1 Newton of force. "
                    "3rd: Every action has an equal and opposite reaction. "
                    "Newton also formulated universal gravitation: F = G(m₁m₂)/r². G = 6.674×10⁻¹¹ N⋅m²/kg²."
                ),
                "position": (-0.4, 0.7, -0.9),
            },
            {
                "model": "vintage_oil_lamp",
                "label": "Electricity & Electromagnetism",
                "text": (
                    "1831 — Michael Faraday discovered electromagnetic induction (a changing magnetic field creates electric current). "
                    "1752: Benjamin Franklin's kite experiment proved lightning is electrical. "
                    "1800: Volta invented the first battery (voltaic pile, 0.76V per cell). "
                    "1879: Edison's practical incandescent bulb (lasted 1,200 hours). "
                    "Maxwell's equations (1865) unified electricity, magnetism, and light: c = 1/√(ε₀μ₀) ≈ 3×10⁸ m/s."
                ),
                "position": (0.5, 1.1, -1.4),
            },
            {
                "model": "decorative_book_set_01",
                "label": "DNA & Genetics",
                "text": (
                    "1953 — Watson & Crick described DNA's double helix structure (using Rosalind Franklin's X-ray Photo 51). "
                    "DNA has 4 bases: Adenine-Thymine, Guanine-Cytosine. Human genome: 3.2 billion base pairs, ~20,000 genes. "
                    "Gregor Mendel (1866) discovered inheritance laws with pea plants (dominant/recessive traits). "
                    "Human DNA is 99.9% identical between individuals. "
                    "If unwound, DNA in one cell would stretch ~2 meters; all DNA in your body would reach the Sun and back 600 times."
                ),
                "position": (1.0, 0.6, -0.6), 
            },
            {
                "model": "Lantern_01",
                "label": "Speed of Light & Relativity",
                "text": (
                    "1905 — Einstein's Special Relativity: E = mc². The speed of light c = 299,792,458 m/s (exact). "
                    "Nothing with mass can reach c. At 90% of c, time dilation factor γ = 2.29 (you age 2.29× slower). "
                    "1915: General Relativity — gravity is the curvature of spacetime by mass. "
                    "Confirmed 1919: Arthur Eddington measured starlight bending around the Sun during an eclipse (1.75 arcseconds). "
                    "GPS satellites correct for both special and general relativistic effects (~38 μs/day drift)."
                ),
                "position": (-1.0, 1.3, -0.5),
            },
            {
                "model": "potted_plant_01",
                "label": "Evolution & Natural Selection",
                "text": (
                    "1859 — Charles Darwin published On the Origin of Species after 20 years of research. "
                    "Visited the Galápagos Islands in 1835 (HMS Beagle voyage, 1831–1836). "
                    "14 species of finches evolved different beak shapes for different food sources (adaptive radiation). "
                    "Key principles: variation, inheritance, selection, time. "
                    "Life on Earth is ~3.8 billion years old. Humans and chimps share ~98.7% DNA, diverged ~6–7 million years ago. "
                    "Alfred Russel Wallace independently conceived the theory in 1858."
                ),
                "position": (0.0, 0.3, -1.8),
            },
            {
                "model": "brass_goblets",
                "label": "The Periodic Table",
                "text": (
                    "1869 — Dmitri Mendeleev arranged 63 known elements by atomic weight, predicting 3 undiscovered elements "
                    "(gallium, scandium, germanium — all found within 15 years). "
                    "Today: 118 confirmed elements. Hydrogen (#1) is 75% of all normal matter in the universe. "
                    "Carbon (#6) forms the basis of all known life — can make 4 bonds, creating complex molecules. "
                    "Heaviest natural element: Uranium (#92, 238.03 u). "
                    "Noble gases (He, Ne, Ar, Kr, Xe, Rn) have full outer shells — extremely unreactive."
                ),
                "position": (-0.6, 0.9, -1.3),
            },
        ]

    async def _seed_items_into_palaces(self, palaces: List[Dict[str, Any]], user_id: str) -> List[Dict[str, Any]]:

        for palace in palaces:
            palace_id = str(palace["id"])
            items = await self.list_items(palace_id)
            if items:
                continue

            is_vr = palace.get("mode") == "vr"
            seed_items = self._history_garden_items() if is_vr else self._science_study_room_items()

            for item_data in seed_items:
                row = await self.db.fetchrow(
                    "SELECT id, name FROM asset_library WHERE asset_type = 'model' AND name = $1",
                    item_data["model"],
                )
                if not row:
                    continue
                pos = item_data["position"]
                await self.create_item(
                    palace_id, user_id,
                    {
                        "position_x": pos[0],
                        "position_y": pos[1],
                        "position_z": pos[2],
                        "asset_id": str(row["id"]),
                        "label": item_data["label"],
                        "custom_text": item_data["text"],
                        "display_type": "3d_model",
                        "scale": 1.0,
                    },
                )

        return palaces


    async def create_item(self, palace_id: str, user_id: str, data: dict) -> Dict[str, Any]:

        mi_row = await self.db.fetchrow(
            "INSERT INTO memory_item (id, status) VALUES ($1, 'active') RETURNING memory_item_id",
            user_id,
        )
        memory_item_id = mi_row["memory_item_id"]

        await self.db.execute(
            """
            INSERT INTO memory_retention_snapshot (id, memory_item_id, predicted_recall, next_review_at)
            VALUES ($1, $2, 1.0, NOW() + INTERVAL '1 day')
            """,
            user_id,
            memory_item_id,
        )

        row = await self.db.fetchrow(
            """
            INSERT INTO palace_items
                (palace_id, user_id, memory_item_id,
                 position_x, position_y, position_z, rotation_y, scale,
                 flashcard_id, concept_id, asset_id, custom_text, custom_image_url, label, display_type)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING *
            """,
            palace_id,
            user_id,
            memory_item_id,
            data.get("position_x", 0.0),
            data.get("position_y", 1.0),
            data.get("position_z", -1.5),
            data.get("rotation_y", 0.0),
            data.get("scale", 1.0),
            str(data["flashcard_id"]) if data.get("flashcard_id") else None,
            str(data["concept_id"]) if data.get("concept_id") else None,
            str(data["asset_id"]) if data.get("asset_id") else None,
            data.get("custom_text"),
            data.get("custom_image_url"),
            data.get("label"),
            data.get("display_type", "card"),
        )
        result = dict(row)
        from datetime import timedelta
        result["next_review_at"] = datetime.now(timezone.utc) + timedelta(days=1)
        result["review_count"] = 0
        result["ease_factor"] = 2.5
        return result

    async def list_items(self, palace_id: str) -> List[Dict[str, Any]]:
        rows = await self.db.fetch(
            """
            SELECT pi.*,
                   mrs.next_review_at,
                   COALESCE(rc.cnt, 0) AS review_count,
                   COALESCE(lr.ease_factor, 2.5) AS ease_factor
            FROM palace_items pi
            LEFT JOIN LATERAL (
                SELECT next_review_at
                FROM memory_retention_snapshot
                WHERE memory_item_id = pi.memory_item_id
                ORDER BY as_of DESC LIMIT 1
            ) mrs ON TRUE
            LEFT JOIN LATERAL (
                SELECT COUNT(*) AS cnt
                FROM memory_review
                WHERE memory_item_id = pi.memory_item_id
            ) rc ON TRUE
            LEFT JOIN LATERAL (
                SELECT ease_factor
                FROM memory_review
                WHERE memory_item_id = pi.memory_item_id
                ORDER BY occurred_at DESC LIMIT 1
            ) lr ON TRUE
            WHERE pi.palace_id = $1
            ORDER BY pi.created_at
            """,
            palace_id,
        )
        return [dict(r) for r in rows]

    async def update_item(self, item_id: str, user_id: str, data: dict) -> Optional[Dict[str, Any]]:
        sets = []
        vals = []
        idx = 3

        for key in ("position_x", "position_y", "position_z", "rotation_y", "scale",
                     "label", "custom_text", "display_type"):
            if key in data and data[key] is not None:
                sets.append(f"{key} = ${idx}")
                vals.append(data[key])
                idx += 1

        for key in ("flashcard_id", "concept_id"):
            if key in data:
                sets.append(f"{key} = ${idx}")
                vals.append(str(data[key]) if data[key] else None)
                idx += 1

        if not sets:
            return None

        sets.append("updated_at = NOW()")
        query = f"UPDATE palace_items SET {', '.join(sets)} WHERE id = $1 AND user_id = $2 RETURNING *"
        row = await self.db.fetchrow(query, item_id, user_id, *vals)
        return dict(row) if row else None

    async def delete_item(self, item_id: str, user_id: str) -> bool:
        result = await self.db.execute(
            "DELETE FROM palace_items WHERE id = $1 AND user_id = $2",
            item_id,
            user_id,
        )
        return result == "DELETE 1"


    async def get_review_items(self, palace_id: str, user_id: str) -> List[Dict[str, Any]]:
        rows = await self.db.fetch(
            """
            SELECT pi.*,
                   mrs.next_review_at,
                   COALESCE(rc.cnt, 0) AS review_count,
                   COALESCE(lr.ease_factor, 2.5) AS ease_factor
            FROM palace_items pi
            JOIN memory_retention_snapshot mrs
                ON mrs.memory_item_id = pi.memory_item_id
                AND mrs.snapshot_id = (
                    SELECT snapshot_id FROM memory_retention_snapshot
                    WHERE memory_item_id = pi.memory_item_id
                    ORDER BY as_of DESC LIMIT 1
                )
            LEFT JOIN LATERAL (
                SELECT COUNT(*) AS cnt FROM memory_review
                WHERE memory_item_id = pi.memory_item_id
            ) rc ON TRUE
            LEFT JOIN LATERAL (
                SELECT ease_factor FROM memory_review
                WHERE memory_item_id = pi.memory_item_id
                ORDER BY occurred_at DESC LIMIT 1
            ) lr ON TRUE
            WHERE pi.palace_id = $1 AND pi.user_id = $2
              AND mrs.next_review_at <= NOW()
            ORDER BY mrs.next_review_at
            """,
            palace_id,
            user_id,
        )
        return [dict(r) for r in rows]

    async def submit_review(self, item_id: str, user_id: str, quality: int) -> Dict[str, Any]:

        item = await self.db.fetchrow(
            "SELECT * FROM palace_items WHERE id = $1 AND user_id = $2",
            item_id,
            user_id,
        )
        if not item:
            raise ValueError("Item not found")

        memory_item_id = item["memory_item_id"]

        last_review = await self.db.fetchrow(
            """
            SELECT interval_days, ease_factor FROM memory_review
            WHERE memory_item_id = $1 ORDER BY occurred_at DESC LIMIT 1
            """,
            memory_item_id,
        )

        if last_review:
            interval = float(last_review["interval_days"] or 1)
            ease = float(last_review["ease_factor"] or 2.5)
        else:
            interval = 1.0
            ease = 2.5

        new_interval, new_ease = self._sm2(quality, interval, ease)

        now = datetime.now(timezone.utc)

        await self.db.execute(
            """
            INSERT INTO memory_review (memory_item_id, grade, correct, interval_days, ease_factor)
            VALUES ($1, $2, $3, $4, $5)
            """,
            memory_item_id,
            quality,
            quality >= 3,
            new_interval,
            new_ease,
        )

        from datetime import timedelta
        next_review = now + timedelta(days=new_interval)

        await self.db.execute(
            """
            INSERT INTO memory_retention_snapshot (id, memory_item_id, predicted_recall, next_review_at)
            VALUES ($1, $2, $3, $4)
            """,
            user_id,
            memory_item_id,
            max(0.0, min(1.0, quality / 5.0)),
            next_review,
        )

        return {
            "item_id": item_id,
            "quality": quality,
            "new_interval_days": new_interval,
            "new_ease_factor": new_ease,
            "next_review_at": next_review.isoformat(),
        }

    @staticmethod
    def _sm2(quality: int, interval: float, ease: float) -> tuple[float, float]:

        if quality < 3:
            new_interval = 1.0
            new_ease = max(1.3, ease - 0.2)
        else:
            if interval <= 1:
                new_interval = 1.0
            elif interval <= 6:
                new_interval = 6.0
            else:
                new_interval = round(interval * ease, 1)
            new_ease = ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
            new_ease = max(1.3, new_ease)

        return new_interval, round(new_ease, 4)
