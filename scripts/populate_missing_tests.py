import asyncio
import os
import sys
from decimal import Decimal

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.laboratory import Laboratory
from app.models.test import (
    TestCategory,
    Test,
    TestParameter,
    TestReferenceRange,
    LabTestPrice,
    SampleTypeEnum,
    TestTypeEnum,
    ResultValueTypeEnum,
)

# Missing & Enhanced Tests Data
# Format:
# (cat_code, test_code, name, short_name, test_type, sample_type, container, prep, tat_hours, price, parameters_list)
# parameter: (param_code, param_name, unit, decimal_prec, result_type, ranges_list)
# range: (gender, min_val, max_val, crit_low, crit_high, display_str)

MISSING_TESTS_DATA = [
    # ----------------------------------------------------
    # THYROID PROFILE & THYROID HORMONES
    # ----------------------------------------------------
    (
        "HOR", "THYROID", "Thyroid Profile (T3, T4, TSH)", "TFT",
        TestTypeEnum.BIOCHEMISTRY, SampleTypeEnum.SERUM, "Gold Top (SST Vacutainer)",
        "Overnight fasting of 8-10 hours recommended. Morning sample preferred before taking thyroid medications.",
        24, 600.00,
        [
            ("T3", "Triiodothyronine Total (T3)", "ng/dL", 2, ResultValueTypeEnum.NUMBER, [
                (None, 80.0, 200.0, 40.0, 300.0, "80.0 - 200.0 ng/dL"),
            ]),
            ("T4", "Thyroxine Total (T4)", "ug/dL", 2, ResultValueTypeEnum.NUMBER, [
                (None, 5.10, 14.10, 2.0, 20.0, "5.10 - 14.10 ug/dL"),
            ]),
            ("TSH", "Thyroid Stimulating Hormone (TSH)", "uIU/mL", 2, ResultValueTypeEnum.NUMBER, [
                (None, 0.35, 4.94, 0.10, 15.0, "0.35 - 4.94 uIU/mL"),
            ]),
        ]
    ),
    (
        "HOR", "TFT-FREE", "Thyroid Profile Free (FT3, FT4, TSH)", "Free TFT",
        TestTypeEnum.BIOCHEMISTRY, SampleTypeEnum.SERUM, "Gold Top (SST Vacutainer)",
        "Morning blood draw preferred before taking daily thyroid hormone dose.",
        24, 900.00,
        [
            ("FT3", "Free Triiodothyronine (FT3)", "pg/mL", 2, ResultValueTypeEnum.NUMBER, [
                (None, 1.71, 3.71, 1.0, 6.0, "1.71 - 3.71 pg/mL"),
            ]),
            ("FT4", "Free Thyroxine (FT4)", "ng/dL", 2, ResultValueTypeEnum.NUMBER, [
                (None, 0.70, 1.48, 0.3, 3.0, "0.70 - 1.48 ng/dL"),
            ]),
            ("TSH", "Thyroid Stimulating Hormone (TSH 3rd Gen)", "uIU/mL", 2, ResultValueTypeEnum.NUMBER, [
                (None, 0.35, 4.94, 0.10, 15.0, "0.35 - 4.94 uIU/mL"),
            ]),
        ]
    ),
    (
        "HOR", "ANTI-TPO", "Anti-Thyroid Peroxidase Antibody (Anti-TPO)", "Anti-TPO",
        TestTypeEnum.BIOCHEMISTRY, SampleTypeEnum.SERUM, "Gold Top (SST Vacutainer)",
        "No special preparation required.",
        24, 1100.00,
        [
            ("TPO_AB", "Anti-Thyroid Peroxidase (TPO) Antibody", "IU/mL", 1, ResultValueTypeEnum.NUMBER, [
                (None, 0.0, 34.0, None, 100.0, "< 34.0 (Normal / Negative)"),
            ]),
        ]
    ),
    (
        "HOR", "ANTI-TG", "Anti-Thyroglobulin Antibody (Anti-Tg)", "Anti-Tg",
        TestTypeEnum.BIOCHEMISTRY, SampleTypeEnum.SERUM, "Gold Top (SST Vacutainer)",
        "No special preparation required.",
        24, 1150.00,
        [
            ("TG_AB", "Anti-Thyroglobulin (Tg) Antibody", "IU/mL", 1, ResultValueTypeEnum.NUMBER, [
                (None, 0.0, 115.0, None, 300.0, "< 115.0 (Normal / Negative)"),
            ]),
        ]
    ),
    (
        "HOR", "THYROGLOBULIN", "Thyroglobulin (Tg) Quantitative", "Thyroglobulin",
        TestTypeEnum.BIOCHEMISTRY, SampleTypeEnum.SERUM, "Gold Top (SST Vacutainer)",
        "Fasting not required.",
        24, 1400.00,
        [
            ("THYRO_TG", "Serum Thyroglobulin (Tg)", "ng/mL", 2, ResultValueTypeEnum.NUMBER, [
                (None, 1.40, 78.00, None, 200.0, "1.40 - 78.00 ng/mL"),
            ]),
        ]
    ),

    # ----------------------------------------------------
    # LIPID PROFILE
    # ----------------------------------------------------
    (
        "BIO", "LIPID", "Lipid Profile", "Lipid",
        TestTypeEnum.BIOCHEMISTRY, SampleTypeEnum.SERUM, "Gold Top (SST Vacutainer)",
        "12 hours strict overnight fasting. Water permitted.",
        12, 650.00,
        [
            ("CHOL", "Total Cholesterol", "mg/dL", 0, ResultValueTypeEnum.NUMBER, [
                (None, 125.0, 200.0, 80.0, 300.0, "Desirable: < 200 mg/dL"),
            ]),
            ("TRIG", "Triglycerides", "mg/dL", 0, ResultValueTypeEnum.NUMBER, [
                (None, 50.0, 150.0, 30.0, 500.0, "Desirable: < 150 mg/dL"),
            ]),
            ("HDL", "HDL Cholesterol (Good Cholesterol)", "mg/dL", 0, ResultValueTypeEnum.NUMBER, [
                ("MALE", 40.0, 60.0, 25.0, 80.0, "> 40 mg/dL (Normal: 40 - 60)"),
                ("FEMALE", 50.0, 70.0, 30.0, 90.0, "> 50 mg/dL (Normal: 50 - 70)"),
            ]),
            ("LDL", "LDL Cholesterol (Calculated)", "mg/dL", 0, ResultValueTypeEnum.NUMBER, [
                (None, 50.0, 100.0, 30.0, 190.0, "Optimal: < 100 mg/dL"),
            ]),
            ("VLDL", "VLDL Cholesterol", "mg/dL", 0, ResultValueTypeEnum.NUMBER, [
                (None, 5.0, 30.0, 2.0, 60.0, "5.0 - 30.0 mg/dL"),
            ]),
            ("CHOL_HDL", "Total Cholesterol / HDL Ratio", "ratio", 1, ResultValueTypeEnum.NUMBER, [
                (None, 3.0, 5.0, None, 7.0, "3.0 - 5.0"),
            ]),
            ("LDL_HDL", "LDL / HDL Ratio", "ratio", 1, ResultValueTypeEnum.NUMBER, [
                (None, 1.5, 3.5, None, 5.0, "1.5 - 3.5"),
            ]),
        ]
    ),

    # ----------------------------------------------------
    # COAGULATION & HEMOSTASIS PROFILE
    # ----------------------------------------------------
    (
        "HEM", "COAGULATION", "Coagulation Profile (PT, INR, APTT, Fibrinogen)", "Coagulation Panel",
        TestTypeEnum.PATHOLOGY, SampleTypeEnum.PLASMA_CITRATE, "Light Blue Top (Sodium Citrate)",
        "Exact blood-to-anticoagulant ratio required. Process within 2 hours of collection.",
        6, 850.00,
        [
            ("PT", "Patient Prothrombin Time", "seconds", 1, ResultValueTypeEnum.NUMBER, [
                (None, 11.0, 14.5, 9.0, 25.0, "11.0 - 14.5 seconds"),
            ]),
            ("INR", "International Normalized Ratio (INR)", "ratio", 2, ResultValueTypeEnum.NUMBER, [
                (None, 0.80, 1.20, 0.5, 3.5, "0.80 - 1.20"),
            ]),
            ("APTT", "Activated Partial Thromboplastin Time", "seconds", 1, ResultValueTypeEnum.NUMBER, [
                (None, 26.0, 38.0, 20.0, 70.0, "26.0 - 38.0 seconds"),
            ]),
            ("FIBRINOGEN", "Plasma Fibrinogen", "mg/dL", 0, ResultValueTypeEnum.NUMBER, [
                (None, 200.0, 400.0, 100.0, 600.0, "200 - 400 mg/dL"),
            ]),
        ]
    ),

    # ----------------------------------------------------
    # ANEMIA PROFILE / IRON DEFICIENCY PANEL
    # ----------------------------------------------------
    (
        "BIO", "ANEMIA-PROFILE", "Complete Anemia Profile (Iron, TIBC, Ferritin)", "Anemia Profile",
        TestTypeEnum.BIOCHEMISTRY, SampleTypeEnum.SERUM, "Gold Top (SST Vacutainer)",
        "Overnight fasting of 8-10 hours. Morning draw required.",
        12, 1500.00,
        [
            ("FE", "Serum Iron", "ug/dL", 1, ResultValueTypeEnum.NUMBER, [
                ("MALE", 65.0, 175.0, 30.0, 250.0, "65.0 - 175.0 ug/dL"),
                ("FEMALE", 50.0, 170.0, 25.0, 250.0, "50.0 - 170.0 ug/dL"),
            ]),
            ("TIBC", "Total Iron Binding Capacity (TIBC)", "ug/dL", 1, ResultValueTypeEnum.NUMBER, [
                (None, 250.0, 450.0, 150.0, 600.0, "250.0 - 450.0 ug/dL"),
            ]),
            ("UIBC", "Unsaturated Iron Binding Capacity (UIBC)", "ug/dL", 1, ResultValueTypeEnum.NUMBER, [
                (None, 110.0, 370.0, 50.0, 500.0, "110.0 - 370.0 ug/dL"),
            ]),
            ("TF_SAT", "Transferrin Saturation", "%", 1, ResultValueTypeEnum.NUMBER, [
                (None, 20.0, 50.0, 10.0, 70.0, "20.0 - 50.0 %"),
            ]),
            ("FERRITIN", "Serum Ferritin", "ng/mL", 1, ResultValueTypeEnum.NUMBER, [
                ("MALE", 20.0, 300.0, 5.0, 600.0, "20.0 - 300.0 ng/mL"),
                ("FEMALE", 10.0, 200.0, 5.0, 450.0, "10.0 - 200.0 ng/mL"),
            ]),
        ]
    ),

    # ----------------------------------------------------
    # BONE MINERAL & CALCIUM PROFILE
    # ----------------------------------------------------
    (
        "BIO", "BONE-MINERAL", "Bone Mineral & Calcium Profile", "Bone Profile",
        TestTypeEnum.BIOCHEMISTRY, SampleTypeEnum.SERUM, "Gold Top (SST Vacutainer)",
        "Fasting of 8-10 hours recommended.",
        12, 800.00,
        [
            ("CAL_TOTAL", "Serum Calcium (Total)", "mg/dL", 2, ResultValueTypeEnum.NUMBER, [
                (None, 8.5, 10.5, 6.5, 13.0, "8.5 - 10.5 mg/dL"),
            ]),
            ("CAL_ION", "Ionized Calcium", "mg/dL", 2, ResultValueTypeEnum.NUMBER, [
                (None, 4.5, 5.3, 3.5, 6.5, "4.5 - 5.3 mg/dL"),
            ]),
            ("PHOS", "Inorganic Phosphorus", "mg/dL", 2, ResultValueTypeEnum.NUMBER, [
                (None, 2.5, 4.5, 1.5, 6.0, "2.5 - 4.5 mg/dL"),
            ]),
            ("ALP", "Alkaline Phosphatase (ALP)", "U/L", 0, ResultValueTypeEnum.NUMBER, [
                (None, 44.0, 147.0, 20.0, 300.0, "44 - 147 U/L"),
            ]),
        ]
    ),

    # ----------------------------------------------------
    # PANCREATIC PROFILE
    # ----------------------------------------------------
    (
        "BIO", "PANCREATIC-PANEL", "Pancreatic Profile (Amylase & Lipase)", "Pancreatic Panel",
        TestTypeEnum.BIOCHEMISTRY, SampleTypeEnum.SERUM, "Gold Top (SST Vacutainer)",
        "No special preparation required.",
        6, 950.00,
        [
            ("AMYLASE", "Serum Amylase", "U/L", 0, ResultValueTypeEnum.NUMBER, [
                (None, 28.0, 100.0, 10.0, 300.0, "28 - 100 U/L"),
            ]),
            ("LIPASE", "Serum Lipase", "U/L", 0, ResultValueTypeEnum.NUMBER, [
                (None, 13.0, 60.0, 5.0, 180.0, "13 - 60 U/L"),
            ]),
        ]
    ),

    # ----------------------------------------------------
    # ELECTROCARDIOGRAM 12-LEAD
    # ----------------------------------------------------
    (
        "CAR", "ECG-12", "Electrocardiogram (ECG 12-Lead)", "ECG",
        TestTypeEnum.CARDIOLOGY, SampleTypeEnum.IMAGING, "Digital ECG Machine",
        "Rest for 5 minutes prior to tracing.",
        2, 300.00,
        [
            ("HR", "Heart Rate", "bpm", 0, ResultValueTypeEnum.NUMBER, [
                (None, 60.0, 100.0, 40.0, 140.0, "60 - 100 bpm"),
            ]),
            ("PR_INT", "PR Interval", "ms", 0, ResultValueTypeEnum.NUMBER, [
                (None, 120.0, 200.0, 80.0, 250.0, "120 - 200 ms"),
            ]),
            ("QRS_DUR", "QRS Duration", "ms", 0, ResultValueTypeEnum.NUMBER, [
                (None, 80.0, 120.0, 60.0, 160.0, "80 - 120 ms"),
            ]),
            ("QTC_INT", "QTc Interval", "ms", 0, ResultValueTypeEnum.NUMBER, [
                (None, 350.0, 450.0, 300.0, 500.0, "350 - 450 ms"),
            ]),
            ("RHYTHM", "Rhythm & Interpretation", "", 0, ResultValueTypeEnum.TEXT, [
                (None, None, None, None, None, "Normal Sinus Rhythm"),
            ]),
        ]
    ),
]


async def run_population():
    print("🚀 Populating missing tests, parameters, and biological reference ranges...")
    async with AsyncSessionLocal() as session:
        # Load category map
        cats_res = await session.execute(select(TestCategory))
        cat_map = {c.code: c for c in cats_res.scalars().all()}

        total_tests_updated = 0
        total_tests_created = 0
        total_params_added = 0
        total_ranges_added = 0

        for t_cat_code, t_code, t_name, t_short, t_type, t_sample, t_container, t_prep, t_tat, t_price, params in MISSING_TESTS_DATA:
            cat = cat_map.get(t_cat_code)
            if not cat:
                print(f"⚠️ Category not found for code: {t_cat_code}")
                continue

            test_res = await session.execute(select(Test).where(Test.code == t_code))
            test = test_res.scalar_one_or_none()

            if not test:
                test = Test(
                    category_id=cat.id,
                    code=t_code,
                    name=t_name,
                    short_name=t_short,
                    test_type=t_type,
                    sample_type=t_sample,
                    sample_container=t_container,
                    preparation_instructions=t_prep,
                    turnaround_hours=t_tat,
                    default_price=Decimal(str(t_price)),
                    is_active=True,
                )
                session.add(test)
                await session.flush()
                total_tests_created += 1
                print(f"  [+] Created Test: {t_code} - {t_name}")
            else:
                # Update attributes if needed
                test.name = t_name
                test.short_name = t_short
                test.sample_container = t_container
                test.preparation_instructions = t_prep
                test.turnaround_hours = t_tat
                test.default_price = Decimal(str(t_price))
                total_tests_updated += 1
                print(f"  [*] Updating existing Test: {t_code} - {t_name}")

            # Check existing parameters for this test
            existing_params_res = await session.execute(
                select(TestParameter).where(TestParameter.test_id == test.id)
            )
            existing_params = {p.code: p for p in existing_params_res.scalars().all()}

            for p_order, (p_code, p_name, p_unit, p_prec, p_val_type, ranges) in enumerate(params, start=1):
                param = existing_params.get(p_code)
                if not param:
                    param = TestParameter(
                        test_id=test.id,
                        code=p_code,
                        name=p_name,
                        short_name=p_code,
                        unit=p_unit,
                        result_type=p_val_type,
                        decimal_precision=p_prec,
                        display_order=p_order,
                    )
                    session.add(param)
                    await session.flush()
                    total_params_added += 1
                    print(f"      -> Added parameter: {p_code} ({p_name})")
                else:
                    param.name = p_name
                    param.unit = p_unit
                    param.result_type = p_val_type
                    param.decimal_precision = p_prec
                    param.display_order = p_order

                # Check reference ranges for this parameter
                existing_rr_res = await session.execute(
                    select(TestReferenceRange).where(TestReferenceRange.parameter_id == param.id)
                )
                existing_rrs = existing_rr_res.scalars().all()

                if not existing_rrs:
                    for gender, min_val, max_val, crit_low, crit_high, disp_str in ranges:
                        rr = TestReferenceRange(
                            parameter_id=param.id,
                            gender=gender,
                            min_value=Decimal(str(min_val)) if min_val is not None else None,
                            max_value=Decimal(str(max_val)) if max_val is not None else None,
                            critical_low=Decimal(str(crit_low)) if crit_low is not None else None,
                            critical_high=Decimal(str(crit_high)) if crit_high is not None else None,
                            display_range_string=disp_str,
                        )
                        session.add(rr)
                        total_ranges_added += 1
                        print(f"         ==> Added reference range: {disp_str}")

        await session.commit()
        print(f"\n📊 Summary: {total_tests_created} created, {total_tests_updated} updated, {total_params_added} params, {total_ranges_added} ranges.")

        # Assign all active tests to all laboratories
        labs_res = await session.execute(select(Laboratory).where(Laboratory.deleted_at.is_(None)))
        labs = labs_res.scalars().all()

        all_tests_res = await session.execute(select(Test).where(Test.is_active == True))
        all_tests = all_tests_res.scalars().all()

        total_lab_assignments = 0
        for lab in labs:
            existing_prices_res = await session.execute(
                select(LabTestPrice.test_id).where(LabTestPrice.lab_id == lab.id)
            )
            existing_tids = set(existing_prices_res.scalars().all())

            for t in all_tests:
                if t.id not in existing_tids:
                    session.add(
                        LabTestPrice(
                            lab_id=lab.id,
                            test_id=t.id,
                            custom_price=t.default_price,
                            discount_percentage=Decimal("0.00"),
                            is_available=True,
                        )
                    )
                    total_lab_assignments += 1

        await session.commit()
        print(f"🏥 Assigned new tests across {len(labs)} laboratories ({total_lab_assignments} new price records).")
        print("✅ Done successfully!")


if __name__ == "__main__":
    asyncio.run(run_population())
