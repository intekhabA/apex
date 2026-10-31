import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.test import Test, TestParameter, TestCategory
from app.services.pdf_engine import infer_group_name, infer_subgroup, get_standard_interpretation


async def update_groups():
    async with AsyncSessionLocal() as session:
        tests_res = await session.execute(select(Test))
        tests = tests_res.scalars().all()

        cats_res = await session.execute(select(TestCategory))
        cats = {c.id: c.name for c in cats_res.scalars().all()}

        t_updated = 0
        for t in tests:
            interp = get_standard_interpretation(t.name, t.code)
            if interp and t.interpretation != interp:
                t.interpretation = interp
                t_updated += 1

        params_res = await session.execute(select(TestParameter))
        params = params_res.scalars().all()
        p_updated = 0
        for p in params:
            t = next((x for x in tests if x.id == p.test_id), None)
            c_name = cats.get(t.category_id, "") if t else ""
            t_name = t.name if t else ""
            t_code = t.code if t else ""

            grp = infer_group_name(c_name, t_name, t_code)
            sg = infer_subgroup(p.name, p.code)
            changed = False
            if p.group_name != grp:
                p.group_name = grp
                changed = True
            if p.subgroup_name != sg:
                p.subgroup_name = sg
                changed = True
            if changed:
                p_updated += 1

        await session.commit()
        print(f"✅ Successfully updated {t_updated} tests with interpretations and {p_updated} parameters with groups/subgroups.")


if __name__ == "__main__":
    asyncio.run(update_groups())
