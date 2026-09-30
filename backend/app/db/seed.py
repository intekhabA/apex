import asyncio
from datetime import datetime, timezone, date
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import AsyncSessionLocal, engine, Base
from app.core.security import get_password_hash
from app.models.laboratory import Laboratory, LaboratorySettings
from app.models.user import User, UserRole
from app.models.test import (
    TestCategory,
    Test,
    TestParameter,
    TestReferenceRange,
    TestPackage,
    TestPackageItem,
    LabTestPrice,
    SampleTypeEnum,
    TestTypeEnum,
    ResultValueTypeEnum,
)


async def seed_database():
    print("🌱 Starting DiagnoLab Database Seeding...")

    # Ensure tables are created
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        # Check if already seeded
        res = await session.execute(select(User).where(User.email == "admin@example.com"))
        if res.scalar_one_or_none():
            print("⚠️ Database already seeded. Skipping initial seeding.")
            return

        # 1. Super Admin
        super_admin = User(
            email="admin@example.com",
            hashed_password=get_password_hash("SuperAdmin@2026!"),
            first_name="Global",
            last_name="SuperAdmin",
            role=UserRole.SUPER_ADMIN,
            is_active=True,
            is_verified=True,
        )
        session.add(super_admin)

        # 2. Laboratory 1: Demo Diagnostic Lab
        lab1 = Laboratory(
            code="LAB-DEMO",
            name="Demo Diagnostic Lab",
            legal_name="Demo Diagnostic Laboratory Healthcare Pvt Ltd",
            registration_number="REG-DL-2024-8890",
            tax_identifier="GSTIN27AABCL1234D1Z5",
            email="contact@demolab.com",
            phone="+91 98765 43210",
            website="https://demolab.diagnolab.internal",
            address_street="101 Wellness Boulevard, HealthCity",
            city="Mumbai",
            state="Maharashtra",
            postal_code="400001",
            country="India",
            is_active=True,
            subscription_plan="ENTERPRISE",
        )
        session.add(lab1)
        await session.flush()

        settings1 = LaboratorySettings(
            lab_id=lab1.id,
            report_disclaimer="This is an electronically generated and authenticated diagnostic report. No physical signature is required. Results relate only to the specimen tested.",
            currency_code="INR",
            currency_symbol="₹",
            default_tax_rate=Decimal("5.00"),
            enable_qr_verification=True,
            primary_color_hex="#0284c7",
            secondary_color_hex="#0f172a",
            default_signatory_name="Dr. Rajesh Varma",
            default_signatory_designation="Chief Consultant Pathologist",
            default_signatory_degrees="MD (Pathology), DCP",
            default_signatory_reg_no="MCI-1998-04561",
        )
        session.add(settings1)

        # Lab 1 Users across all roles
        lab1_admin = User(
            lab_id=lab1.id,
            email="admin@demolab.com",
            hashed_password=get_password_hash("LabAdmin@2026!"),
            first_name="Anil",
            last_name="Sharma",
            role=UserRole.LAB_ADMIN,
            is_active=True,
            is_verified=True,
            phone="+91 98200 11223",
        )
        lab1_assistant = User(
            lab_id=lab1.id,
            email="assistant@demolab.com",
            hashed_password=get_password_hash("Assistant@2026!"),
            first_name="Pooja",
            last_name="Nair",
            role=UserRole.LAB_ASSISTANT,
            is_active=True,
            is_verified=True,
            phone="+91 98200 44556",
        )
        lab1_pathologist = User(
            lab_id=lab1.id,
            email="pathologist@demolab.com",
            hashed_password=get_password_hash("Pathologist@2026!"),
            first_name="Dr. Rajesh",
            last_name="Varma",
            role=UserRole.PATHOLOGIST,
            medical_license_number="MCI-1998-04561",
            qualifications="MD (Pathology), DCP",
            is_active=True,
            is_verified=True,
            phone="+91 98200 77889",
        )
        lab1_radiologist = User(
            lab_id=lab1.id,
            email="radiologist@demolab.com",
            hashed_password=get_password_hash("Radiologist@2026!"),
            first_name="Dr. Sunita",
            last_name="Deshmukh",
            role=UserRole.RADIOLOGIST,
            medical_license_number="MCI-2005-09823",
            qualifications="MD (Radiodiagnosis), DNB",
            is_active=True,
            is_verified=True,
            phone="+91 98200 33445",
        )
        lab1_receptionist = User(
            lab_id=lab1.id,
            email="receptionist@demolab.com",
            hashed_password=get_password_hash("Receptionist@2026!"),
            first_name="Kavita",
            last_name="Rao",
            role=UserRole.RECEPTIONIST,
            is_active=True,
            is_verified=True,
            phone="+91 98200 66778",
        )
        lab1_patient = User(
            lab_id=lab1.id,
            email="patient@example.com",
            hashed_password=get_password_hash("Patient@2026!"),
            first_name="Amit",
            last_name="Kumar",
            role=UserRole.PATIENT,
            is_active=True,
            is_verified=True,
            phone="+91 98111 22334",
        )

        session.add_all([lab1_admin, lab1_assistant, lab1_pathologist, lab1_radiologist, lab1_receptionist, lab1_patient])

        # 3. Laboratory 2: City Care Diagnostics
        lab2 = Laboratory(
            code="LAB-CITYCARE",
            name="City Care Diagnostics",
            legal_name="City Care Diagnostic & Imaging Center LLP",
            registration_number="REG-CC-2023-1044",
            tax_identifier="GSTIN07XYZW5678F2Z1",
            email="contact@citycare.com",
            phone="+91 98765 99887",
            website="https://citycare.diagnolab.internal",
            address_street="45 Central Ring Road, Sector 14",
            city="Delhi",
            state="Delhi",
            postal_code="110001",
            country="India",
            is_active=True,
            subscription_plan="STANDARD",
        )
        session.add(lab2)
        await session.flush()

        settings2 = LaboratorySettings(
            lab_id=lab2.id,
            report_disclaimer="Diagnostic tests are processed in accordance with standard medical laboratory protocols.",
            currency_code="INR",
            currency_symbol="₹",
            default_tax_rate=Decimal("0.00"),
            enable_qr_verification=True,
            primary_color_hex="#0d9488",
            secondary_color_hex="#1e293b",
            default_signatory_name="Dr. Vikram Sen",
            default_signatory_designation="Consultant Clinical Biochemist",
            default_signatory_degrees="MD (Biochemistry)",
            default_signatory_reg_no="DMC-2002-3312",
        )
        session.add(settings2)

        lab2_admin = User(
            lab_id=lab2.id,
            email="admin@citycare.com",
            hashed_password=get_password_hash("LabAdmin@2026!"),
            first_name="Rohit",
            last_name="Mehta",
            role=UserRole.LAB_ADMIN,
            is_active=True,
            is_verified=True,
            phone="+91 98300 55667",
        )
        session.add(lab2_admin)

        # 4. Master Test Categories
        cat_hem = TestCategory(code="HEM", name="Hematology", description="Blood cells, coagulation, and bone marrow", display_order=1)
        cat_bio = TestCategory(code="BIO", name="Biochemistry", description="Clinical chemistry, enzymes, organ function", display_order=2)
        cat_rad = TestCategory(code="RAD", name="Radiology & Imaging", description="X-Ray, Ultrasound, and Diagnostic Imaging", display_order=3)
        cat_hor = TestCategory(code="HOR", name="Hormones & Serology", description="Thyroid, fertility, immunology", display_order=4)
        cat_car = TestCategory(code="CAR", name="Cardiology", description="ECG and cardiac function tests", display_order=5)

        session.add_all([cat_hem, cat_bio, cat_rad, cat_hor, cat_car])
        await session.flush()

        # 5. Master Tests & Parameters
        # 5.1 CBC (Complete Blood Count)
        test_cbc = Test(
            category_id=cat_hem.id,
            code="CBC",
            name="Complete Blood Count (CBC)",
            short_name="CBC",
            test_type=TestTypeEnum.PATHOLOGY,
            sample_type=SampleTypeEnum.WHOLE_BLOOD_EDTA,
            sample_container="Lavender Top (EDTA Vacutainer)",
            preparation_instructions="No special preparation required.",
            turnaround_hours=12,
            default_price=Decimal("450.00"),
            is_active=True,
        )
        session.add(test_cbc)
        await session.flush()

        # CBC Parameters & Reference Ranges
        cbc_params = [
            ("HB", "Hemoglobin", "g/dL", [("MALE", 13.0, 17.0, "13.0 - 17.0"), ("FEMALE", 12.0, 15.0, "12.0 - 15.0")]),
            ("RBC", "RBC Count", "mil/uL", [(None, 4.5, 5.9, "4.5 - 5.9")]),
            ("WBC", "Total Leukocyte Count (TLC)", "cells/mcL", [(None, 4000.0, 11000.0, "4000 - 11000")]),
            ("PLT", "Platelet Count", "lakhs/mcL", [(None, 1.5, 4.5, "1.5 - 4.5")]),
            ("HCT", "Hematocrit (PCV)", "%", [("MALE", 40.0, 50.0, "40.0 - 50.0"), ("FEMALE", 36.0, 46.0, "36.0 - 46.0")]),
            ("MCV", "Mean Corpuscular Volume (MCV)", "fL", [(None, 80.0, 100.0, "80.0 - 100.0")]),
            ("MCH", "Mean Corpuscular Hemoglobin (MCH)", "pg", [(None, 27.0, 32.0, "27.0 - 32.0")]),
            ("MCHC", "Mean Corpuscular Hb Conc (MCHC)", "g/dL", [(None, 32.0, 36.0, "32.0 - 36.0")]),
            ("NEUT", "Neutrophils", "%", [(None, 40.0, 75.0, "40 - 75")]),
            ("LYMPH", "Lymphocytes", "%", [(None, 20.0, 45.0, "20 - 45")]),
            ("EOS", "Eosinophils", "%", [(None, 1.0, 6.0, "1 - 6")]),
            ("MONO", "Monocytes", "%", [(None, 2.0, 8.0, "2 - 8")]),
            ("BASO", "Basophils", "%", [(None, 0.0, 1.0, "0 - 1")]),
        ]

        for order, (p_code, p_name, p_unit, ranges) in enumerate(cbc_params, start=1):
            param = TestParameter(
                test_id=test_cbc.id,
                code=p_code,
                name=p_name,
                short_name=p_code,
                unit=p_unit,
                result_type=ResultValueTypeEnum.NUMBER,
                decimal_precision=2 if p_code not in ["WBC", "NEUT", "LYMPH", "EOS", "MONO", "BASO"] else 0,
                display_order=order,
            )
            session.add(param)
            await session.flush()
            for gender, min_val, max_val, display_str in ranges:
                rr = TestReferenceRange(
                    parameter_id=param.id,
                    gender=gender,
                    min_value=Decimal(str(min_val)),
                    max_value=Decimal(str(max_val)),
                    display_range_string=display_str,
                )
                session.add(rr)

        # 5.2 LFT (Liver Function Test)
        test_lft = Test(
            category_id=cat_bio.id,
            code="LFT",
            name="Liver Function Test (LFT)",
            short_name="LFT",
            test_type=TestTypeEnum.BIOCHEMISTRY,
            sample_type=SampleTypeEnum.SERUM,
            sample_container="Gold Top (SST Vacutainer)",
            preparation_instructions="Fasting of 10-12 hours recommended.",
            turnaround_hours=24,
            default_price=Decimal("750.00"),
            is_active=True,
        )
        session.add(test_lft)
        await session.flush()

        lft_params = [
            ("TBIL", "Total Bilirubin", "mg/dL", [(None, 0.3, 1.2, "0.3 - 1.2")]),
            ("DBIL", "Direct Bilirubin", "mg/dL", [(None, 0.0, 0.3, "0.0 - 0.3")]),
            ("IBIL", "Indirect Bilirubin", "mg/dL", [(None, 0.2, 0.8, "0.2 - 0.8")]),
            ("SGOT", "SGOT (AST)", "U/L", [("MALE", 15.0, 40.0, "15 - 40"), ("FEMALE", 13.0, 35.0, "13 - 35")]),
            ("SGPT", "SGPT (ALT)", "U/L", [("MALE", 10.0, 45.0, "10 - 45"), ("FEMALE", 7.0, 35.0, "7 - 35")]),
            ("ALP", "Alkaline Phosphatase (ALP)", "U/L", [(None, 44.0, 147.0, "44 - 147")]),
            ("TP", "Total Protein", "g/dL", [(None, 6.4, 8.3, "6.4 - 8.3")]),
            ("ALB", "Albumin", "g/dL", [(None, 3.5, 5.0, "3.5 - 5.0")]),
            ("GLOB", "Globulin", "g/dL", [(None, 2.0, 3.5, "2.0 - 3.5")]),
            ("AGR", "A/G Ratio", "ratio", [(None, 1.0, 2.2, "1.0 - 2.2")]),
        ]

        for order, (p_code, p_name, p_unit, ranges) in enumerate(lft_params, start=1):
            param = TestParameter(
                test_id=test_lft.id,
                code=p_code,
                name=p_name,
                short_name=p_code,
                unit=p_unit,
                result_type=ResultValueTypeEnum.NUMBER,
                decimal_precision=1 if p_code in ["TBIL", "DBIL", "IBIL", "TP", "ALB", "GLOB", "AGR"] else 0,
                display_order=order,
            )
            session.add(param)
            await session.flush()
            for gender, min_val, max_val, display_str in ranges:
                rr = TestReferenceRange(
                    parameter_id=param.id,
                    gender=gender,
                    min_value=Decimal(str(min_val)),
                    max_value=Decimal(str(max_val)),
                    display_range_string=display_str,
                )
                session.add(rr)

        # 5.3 KFT (Kidney Function Test)
        test_kft = Test(
            category_id=cat_bio.id,
            code="KFT",
            name="Kidney Function Test (KFT)",
            short_name="KFT",
            test_type=TestTypeEnum.BIOCHEMISTRY,
            sample_type=SampleTypeEnum.SERUM,
            sample_container="Gold Top (SST Vacutainer)",
            preparation_instructions="Fasting of 8-10 hours recommended.",
            turnaround_hours=24,
            default_price=Decimal("700.00"),
            is_active=True,
        )
        session.add(test_kft)
        await session.flush()

        kft_params = [
            ("UREA", "Blood Urea", "mg/dL", [(None, 15.0, 45.0, "15 - 45")]),
            ("CREAT", "Serum Creatinine", "mg/dL", [("MALE", 0.7, 1.3, "0.7 - 1.3"), ("FEMALE", 0.6, 1.1, "0.6 - 1.1")]),
            ("URIC", "Uric Acid", "mg/dL", [("MALE", 3.5, 7.2, "3.5 - 7.2"), ("FEMALE", 2.6, 6.0, "2.6 - 6.0")]),
            ("SOD", "Sodium (Na+)", "mEq/L", [(None, 136.0, 145.0, "136 - 145")]),
            ("POT", "Potassium (K+)", "mEq/L", [(None, 3.5, 5.1, "3.5 - 5.1")]),
            ("CHL", "Chloride (Cl-)", "mEq/L", [(None, 98.0, 107.0, "98 - 107")]),
        ]

        for order, (p_code, p_name, p_unit, ranges) in enumerate(kft_params, start=1):
            param = TestParameter(
                test_id=test_kft.id,
                code=p_code,
                name=p_name,
                short_name=p_code,
                unit=p_unit,
                result_type=ResultValueTypeEnum.NUMBER,
                decimal_precision=2 if p_code == "CREAT" else (1 if p_code in ["URIC", "SOD", "POT", "CHL"] else 0),
                display_order=order,
            )
            session.add(param)
            await session.flush()
            for gender, min_val, max_val, display_str in ranges:
                rr = TestReferenceRange(
                    parameter_id=param.id,
                    gender=gender,
                    min_value=Decimal(str(min_val)),
                    max_value=Decimal(str(max_val)),
                    display_range_string=display_str,
                )
                session.add(rr)

        # 5.4 Lipid Profile
        test_lipid = Test(
            category_id=cat_bio.id,
            code="LIPID",
            name="Lipid Profile",
            short_name="Lipid",
            test_type=TestTypeEnum.BIOCHEMISTRY,
            sample_type=SampleTypeEnum.SERUM,
            sample_container="Gold Top (SST Vacutainer)",
            preparation_instructions="12 hours strict overnight fasting.",
            turnaround_hours=24,
            default_price=Decimal("650.00"),
            is_active=True,
        )
        session.add(test_lipid)
        await session.flush()

        # 5.5 Thyroid Profile
        test_tft = Test(
            category_id=cat_hor.id,
            code="THYROID",
            name="Thyroid Profile (T3, T4, TSH)",
            short_name="TFT",
            test_type=TestTypeEnum.PATHOLOGY,
            sample_type=SampleTypeEnum.SERUM,
            sample_container="Gold Top (SST Vacutainer)",
            preparation_instructions="Morning sample preferred before taking thyroid medications.",
            turnaround_hours=24,
            default_price=Decimal("600.00"),
            is_active=True,
        )
        session.add(test_tft)
        await session.flush()

        # 5.6 X-Ray Chest PA View
        test_xray = Test(
            category_id=cat_rad.id,
            code="XRAY-CHEST",
            name="X-Ray Chest PA View",
            short_name="X-Ray Chest",
            test_type=TestTypeEnum.RADIOLOGY,
            sample_type=SampleTypeEnum.IMAGING,
            sample_container="Digital Imaging (CR/DR)",
            preparation_instructions="Remove metallic items, jewelry, and coins before exposure.",
            turnaround_hours=4,
            default_price=Decimal("500.00"),
            is_active=True,
        )
        session.add(test_xray)
        await session.flush()

        # 5.7 Ultrasound Abdomen
        test_usg = Test(
            category_id=cat_rad.id,
            code="USG-ABDOMEN",
            name="Ultrasound Whole Abdomen",
            short_name="USG Abdomen",
            test_type=TestTypeEnum.RADIOLOGY,
            sample_type=SampleTypeEnum.IMAGING,
            sample_container="Sonography Workstation",
            preparation_instructions="Full urinary bladder required. Fasting for 4-6 hours.",
            turnaround_hours=6,
            default_price=Decimal("1200.00"),
            is_active=True,
        )
        session.add(test_usg)
        await session.flush()

        # 5.8 ECG
        test_ecg = Test(
            category_id=cat_car.id,
            code="ECG-12",
            name="Electrocardiogram (ECG 12-Lead)",
            short_name="ECG",
            test_type=TestTypeEnum.CARDIOLOGY,
            sample_type=SampleTypeEnum.IMAGING,
            sample_container="Digital ECG Machine",
            preparation_instructions="Rest for 5 minutes prior to tracing.",
            turnaround_hours=2,
            default_price=Decimal("300.00"),
            is_active=True,
        )
        session.add(test_ecg)
        await session.flush()

        # 6. Test Package: Full Body Checkup
        pkg_full_body = TestPackage(
            code="PKG-FULL-BODY",
            name="Comprehensive Full Body Health Checkup",
            description="Complete clinical wellness evaluation covering CBC, LFT, KFT, and Lipid Profile.",
            price=Decimal("1999.00"),  # Discounted bundle price
            discount_percentage=Decimal("25.00"),
            is_active=True,
        )
        session.add(pkg_full_body)
        await session.flush()

        for t in [test_cbc, test_lft, test_kft, test_lipid]:
            session.add(TestPackageItem(package_id=pkg_full_body.id, test_id=t.id))

        await session.commit()
        print("✅ Database seeding completed successfully!")
        print("=================================================================")
        print("🔑 DEVELOPMENT ONLY CREDENTIALS:")
        print("Platform Super Admin:  admin@example.com       / SuperAdmin@2026!")
        print("Demo Lab Admin:        admin@demolab.com       / LabAdmin@2026!")
        print("Demo Lab Assistant:    assistant@demolab.com   / Assistant@2026!")
        print("Demo Lab Pathologist:  pathologist@demolab.com / Pathologist@2026!")
        print("Demo Lab Radiologist:  radiologist@demolab.com / Radiologist@2026!")
        print("Demo Lab Receptionist: receptionist@demolab.com/ Receptionist@2026!")
        print("Demo Lab Patient:      patient@example.com     / Patient@2026!")
        print("City Care Lab Admin:   admin@citycare.com      / LabAdmin@2026!")
        print("=================================================================")


if __name__ == "__main__":
    asyncio.run(seed_database())
