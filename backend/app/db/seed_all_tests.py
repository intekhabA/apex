import asyncio
import os
import sys
from decimal import Decimal
from typing import List, Tuple, Optional

# Ensure app is importable
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.test import (
    TestCategory,
    Test,
    TestParameter,
    TestReferenceRange,
    TestPackage,
    TestPackageItem,
    SampleTypeEnum,
    TestTypeEnum,
    ResultValueTypeEnum,
)

CATEGORIES_DATA = [
    ("HEM", "Hematology", "Blood cells, complete hemogram, coagulation, and anemia evaluation", 1),
    ("BIO", "Biochemistry", "Clinical chemistry, organ function tests, metabolic profiling", 2),
    ("DIA", "Diabetes & Metabolism", "Blood glucose monitoring, HbA1c, insulin, and metabolic markers", 3),
    ("HOR", "Hormones & Endocrinology", "Thyroid, vitamins, reproductive and endocrine hormones", 4),
    ("SER", "Serology & Immunology", "Infectious disease antigens, antibodies, and autoimmune markers", 5),
    ("URN", "Clinical Pathology & Urinalysis", "Routine urine, stool microscopy, body fluids, and semen analysis", 6),
    ("MIC", "Microbiology & Cultures", "Bacterial, fungal cultures, AFB stains, and antibiotic sensitivity", 7),
    ("RAD", "Radiology & Imaging", "Digital X-Ray, Sonography / Ultrasound, and diagnostic imaging", 8),
    ("CAR", "Cardiology & Pulmonology", "ECG, 2D Echocardiography, treadmill stress test, and lung function", 9),
]

# Structure:
# (category_code, test_code, name, short_name, test_type, sample_type, container, prep_instructions, tat_hours, price, parameters_list)
# parameter: (param_code, param_name, unit, decimal_places, result_type, ranges_list)
# range: (gender, min_val, max_val, display_range_str)

TESTS_DATA = [
    # ----------------------------------------------------
    # HEMATOLOGY & COAGULATION
    # ----------------------------------------------------
    (
        "HEM", "ESR", "Erythrocyte Sedimentation Rate (ESR)", "ESR",
        TestTypeEnum.PATHOLOGY, SampleTypeEnum.WHOLE_BLOOD_EDTA, "Black Top / EDTA Lavender",
        "No special preparation required.", 4, 150.00,
        [
            ("ESR", "ESR (Westergren)", "mm/hr", 0, ResultValueTypeEnum.NUMBER, [
                ("MALE", 0.0, 15.0, "0 - 15"),
                ("FEMALE", 0.0, 20.0, "0 - 20"),
            ]),
        ]
    ),
    (
        "HEM", "BLD-GRP", "Blood Grouping & Rh Typing", "Blood Group",
        TestTypeEnum.PATHOLOGY, SampleTypeEnum.WHOLE_BLOOD_EDTA, "Lavender Top (EDTA Vacutainer)",
        "No special preparation required.", 2, 200.00,
        [
            ("ABO", "ABO Blood Group", "", 0, ResultValueTypeEnum.TEXT, [
                (None, None, None, "A / B / AB / O"),
            ]),
            ("RH", "Rh (D) Factor", "", 0, ResultValueTypeEnum.TEXT, [
                (None, None, None, "Positive / Negative"),
            ]),
        ]
    ),
    (
        "HEM", "PBS", "Peripheral Blood Smear Examination", "PBS",
        TestTypeEnum.PATHOLOGY, SampleTypeEnum.WHOLE_BLOOD_EDTA, "Lavender Top (EDTA Vacutainer)",
        "Fresh blood smear prepared for morphological evaluation.", 6, 250.00,
        [
            ("RBC_MORPH", "RBC Morphology", "", 0, ResultValueTypeEnum.TEXT, [(None, None, None, "Normocytic Normochromic")]),
            ("WBC_MORPH", "WBC Morphology", "", 0, ResultValueTypeEnum.TEXT, [(None, None, None, "Normal in number and distribution")]),
            ("PLT_MORPH", "Platelets on Smear", "", 0, ResultValueTypeEnum.TEXT, [(None, None, None, "Adequate on smear")]),
            ("MP_SMEAR", "Malarial Parasite (MP)", "", 0, ResultValueTypeEnum.POSITIVE_NEGATIVE, [(None, None, None, "Not Seen / Negative")]),
        ]
    ),
    (
        "HEM", "PT-INR", "Prothrombin Time & INR (Coagulation)", "PT-INR",
        TestTypeEnum.PATHOLOGY, SampleTypeEnum.PLASMA_CITRATE, "Light Blue Top (Sodium Citrate)",
        "Exact blood-to-anticoagulant ratio required. Avoid prolonged tourniquet.", 6, 450.00,
        [
            ("PT_TIME", "Patient Prothrombin Time", "seconds", 1, ResultValueTypeEnum.NUMBER, [(None, 11.0, 14.5, "11.0 - 14.5")]),
            ("PT_CTRL", "Control Prothrombin Time", "seconds", 1, ResultValueTypeEnum.NUMBER, [(None, 11.0, 13.0, "11.0 - 13.0")]),
            ("INR", "International Normalized Ratio (INR)", "ratio", 2, ResultValueTypeEnum.NUMBER, [(None, 0.8, 1.2, "0.8 - 1.2")]),
        ]
    ),
    (
        "HEM", "APTT", "Activated Partial Thromboplastin Time", "APTT",
        TestTypeEnum.PATHOLOGY, SampleTypeEnum.PLASMA_CITRATE, "Light Blue Top (Sodium Citrate)",
        "Process within 2 hours of collection.", 6, 500.00,
        [
            ("APTT_PATIENT", "Patient APTT", "seconds", 1, ResultValueTypeEnum.NUMBER, [(None, 26.0, 38.0, "26.0 - 38.0")]),
            ("APTT_CTRL", "Control APTT", "seconds", 1, ResultValueTypeEnum.NUMBER, [(None, 28.0, 34.0, "28.0 - 34.0")]),
            ("APTT_RATIO", "APTT Ratio", "ratio", 2, ResultValueTypeEnum.NUMBER, [(None, 0.8, 1.2, "0.8 - 1.2")]),
        ]
    ),
    (
        "HEM", "BT-CT", "Bleeding Time & Clotting Time", "BT / CT",
        TestTypeEnum.PATHOLOGY, SampleTypeEnum.OTHER, "Capillary Blood / Duke/Ivy Method",
        "Bedside puncture test.", 1, 150.00,
        [
            ("BT", "Bleeding Time", "minutes", 1, ResultValueTypeEnum.NUMBER, [(None, 2.0, 7.0, "2 - 7 min")]),
            ("CT", "Clotting Time", "minutes", 1, ResultValueTypeEnum.NUMBER, [(None, 4.0, 10.0, "4 - 10 min")]),
        ]
    ),
    (
        "HEM", "AEC", "Absolute Eosinophil Count", "AEC",
        TestTypeEnum.PATHOLOGY, SampleTypeEnum.WHOLE_BLOOD_EDTA, "Lavender Top (EDTA Vacutainer)",
        "Morning sample preferred.", 4, 200.00,
        [
            ("AEC", "Absolute Eosinophils", "cells/mcL", 0, ResultValueTypeEnum.NUMBER, [(None, 40.0, 450.0, "40 - 450")]),
        ]
    ),
    (
        "HEM", "RETIC", "Reticulocyte Count", "Retic Count",
        TestTypeEnum.PATHOLOGY, SampleTypeEnum.WHOLE_BLOOD_EDTA, "Lavender Top (EDTA Vacutainer)",
        "Supravital staining with New Methylene Blue.", 6, 300.00,
        [
            ("RETIC_PCT", "Reticulocyte Percentage", "%", 2, ResultValueTypeEnum.NUMBER, [(None, 0.5, 2.5, "0.5 - 2.5")]),
            ("ARC", "Absolute Reticulocyte Count", "cells/uL", 0, ResultValueTypeEnum.NUMBER, [(None, 25000.0, 100000.0, "25,000 - 100,000")]),
        ]
    ),
    (
        "HEM", "D-DIMER", "D-Dimer Quantitative", "D-Dimer",
        TestTypeEnum.PATHOLOGY, SampleTypeEnum.PLASMA_CITRATE, "Light Blue Top (Sodium Citrate)",
        "Centrifuge immediately. Useful for DVT and pulmonary embolism evaluation.", 6, 1200.00,
        [
            ("DDIMER", "D-Dimer", "ng/mL FEU", 1, ResultValueTypeEnum.NUMBER, [(None, 0.0, 500.0, "< 500.0")]),
        ]
    ),
    (
        "HEM", "FERRITIN", "Serum Ferritin", "Ferritin",
        TestTypeEnum.PATHOLOGY, SampleTypeEnum.SERUM, "Gold Top (SST Vacutainer)",
        "Avoid iron supplements 24 hours prior.", 12, 800.00,
        [
            ("FERRITIN", "Serum Ferritin", "ng/mL", 1, ResultValueTypeEnum.NUMBER, [
                ("MALE", 30.0, 400.0, "30.0 - 400.0"),
                ("FEMALE", 15.0, 150.0, "15.0 - 150.0"),
            ]),
        ]
    ),
    (
        "HEM", "IRON-PROFILE", "Iron & Total Iron Binding Capacity (TIBC)", "Iron Profile",
        TestTypeEnum.BIOCHEMISTRY, SampleTypeEnum.SERUM, "Gold Top (SST Vacutainer)",
        "10-12 hours overnight fasting. Avoid iron pills.", 12, 750.00,
        [
            ("SERUM_IRON", "Serum Iron", "ug/dL", 1, ResultValueTypeEnum.NUMBER, [
                ("MALE", 65.0, 175.0, "65 - 175"),
                ("FEMALE", 50.0, 170.0, "50 - 170"),
            ]),
            ("TIBC", "Total Iron Binding Capacity (TIBC)", "ug/dL", 1, ResultValueTypeEnum.NUMBER, [(None, 240.0, 450.0, "240 - 450")]),
            ("UIBC", "Unsaturated Iron Binding Capacity (UIBC)", "ug/dL", 1, ResultValueTypeEnum.NUMBER, [(None, 140.0, 280.0, "140 - 280")]),
            ("TRANS_SAT", "Transferrin Saturation", "%", 1, ResultValueTypeEnum.NUMBER, [(None, 20.0, 50.0, "20.0 - 50.0")]),
        ]
    ),
    (
        "HEM", "VIT-B12", "Vitamin B12 (Cyanocobalamin)", "Vit B12",
        TestTypeEnum.BIOCHEMISTRY, SampleTypeEnum.SERUM, "Gold Top (SST Vacutainer)",
        "Overnight fasting recommended. Protect sample from light.", 24, 900.00,
        [
            ("VITB12", "Vitamin B12", "pg/mL", 1, ResultValueTypeEnum.NUMBER, [(None, 211.0, 911.0, "211 - 911")]),
        ]
    ),

    # ----------------------------------------------------
    # DIABETES & METABOLISM
    # ----------------------------------------------------
    (
        "DIA", "FBS", "Fasting Blood Sugar (Glucose Fasting)", "FBS",
        TestTypeEnum.BIOCHEMISTRY, SampleTypeEnum.SERUM, "Grey Top (Fluoride Vacutainer)",
        "Strict 8-10 hours overnight fasting. Water permitted.", 4, 100.00,
        [
            ("GLU_FAST", "Fasting Plasma Glucose", "mg/dL", 1, ResultValueTypeEnum.NUMBER, [(None, 70.0, 99.0, "70 - 99 (Normal), 100-125 (Pre-diabetic)")]),
        ]
    ),
    (
        "DIA", "PPBS", "Postprandial Blood Sugar (PP Glucose)", "PPBS",
        TestTypeEnum.BIOCHEMISTRY, SampleTypeEnum.SERUM, "Grey Top (Fluoride Vacutainer)",
        "Collect sample exactly 2 hours after start of main meal.", 4, 100.00,
        [
            ("GLU_PP", "Postprandial Plasma Glucose", "mg/dL", 1, ResultValueTypeEnum.NUMBER, [(None, 70.0, 140.0, "< 140 (Normal), 140-199 (Pre-diabetic)")]),
        ]
    ),
    (
        "DIA", "RBS", "Random Blood Sugar", "RBS",
        TestTypeEnum.BIOCHEMISTRY, SampleTypeEnum.SERUM, "Grey Top (Fluoride Vacutainer)",
        "No preparation required. Can be drawn at any time.", 2, 100.00,
        [
            ("GLU_RANDOM", "Random Plasma Glucose", "mg/dL", 1, ResultValueTypeEnum.NUMBER, [(None, 70.0, 140.0, "70 - 140")]),
        ]
    ),
    (
        "DIA", "HBA1C", "Glycated Hemoglobin (HbA1c)", "HbA1c",
        TestTypeEnum.BIOCHEMISTRY, SampleTypeEnum.WHOLE_BLOOD_EDTA, "Lavender Top (EDTA Vacutainer)",
        "No fasting required. Measures 3-month glycemic control.", 6, 500.00,
        [
            ("HBA1C_VAL", "HbA1c (NGSP)", "%", 2, ResultValueTypeEnum.NUMBER, [(None, 4.0, 5.6, "< 5.7 (Normal), 5.7-6.4 (Pre-diabetic), >= 6.5 (Diabetic)")]),
            ("EAG", "Estimated Average Glucose (eAG)", "mg/dL", 1, ResultValueTypeEnum.NUMBER, [(None, 70.0, 126.0, "70 - 126")]),
        ]
    ),
    (
        "DIA", "INSULIN-FAST", "Fasting Serum Insulin", "Fasting Insulin",
        TestTypeEnum.BIOCHEMISTRY, SampleTypeEnum.SERUM, "Gold Top (SST Vacutainer)",
        "10-12 hours strict overnight fasting.", 24, 850.00,
        [
            ("INSULIN", "Fasting Insulin", "uIU/mL", 2, ResultValueTypeEnum.NUMBER, [(None, 2.6, 24.9, "2.6 - 24.9")]),
        ]
    ),
    (
        "DIA", "GTT", "Oral Glucose Tolerance Test (OGTT 75g)", "GTT",
        TestTypeEnum.BIOCHEMISTRY, SampleTypeEnum.SERUM, "Grey Top (Fluoride Vacutainer)",
        "Fasting sample followed by 75g glucose load with timed draws.", 6, 350.00,
        [
            ("GTT_FAST", "Fasting Blood Glucose", "mg/dL", 1, ResultValueTypeEnum.NUMBER, [(None, 70.0, 100.0, "70 - 100")]),
            ("GTT_1HR", "1-Hour Post 75g Glucose", "mg/dL", 1, ResultValueTypeEnum.NUMBER, [(None, 0.0, 180.0, "< 180")]),
            ("GTT_2HR", "2-Hour Post 75g Glucose", "mg/dL", 1, ResultValueTypeEnum.NUMBER, [(None, 0.0, 140.0, "< 140")]),
        ]
    ),

    # ----------------------------------------------------
    # BIOCHEMISTRY & ORGAN FUNCTION
    # ----------------------------------------------------
    (
        "BIO", "ELECTROLYTES", "Serum Electrolytes (Na, K, Cl)", "Electrolytes",
        TestTypeEnum.BIOCHEMISTRY, SampleTypeEnum.SERUM, "Gold Top (SST Vacutainer)",
        "Avoid prolonged stasis and hemolysis.", 4, 550.00,
        [
            ("SODIUM", "Sodium (Na+)", "mEq/L", 1, ResultValueTypeEnum.NUMBER, [(None, 136.0, 145.0, "136 - 145")]),
            ("POTASSIUM", "Potassium (K+)", "mEq/L", 2, ResultValueTypeEnum.NUMBER, [(None, 3.5, 5.1, "3.5 - 5.1")]),
            ("CHLORIDE", "Chloride (Cl-)", "mEq/L", 1, ResultValueTypeEnum.NUMBER, [(None, 98.0, 107.0, "98 - 107")]),
            ("BICARB", "Bicarbonate (HCO3)", "mEq/L", 1, ResultValueTypeEnum.NUMBER, [(None, 22.0, 29.0, "22 - 29")]),
        ]
    ),
    (
        "BIO", "CALCIUM", "Serum Calcium (Total & Ionized)", "Calcium",
        TestTypeEnum.BIOCHEMISTRY, SampleTypeEnum.SERUM, "Gold Top (SST Vacutainer)",
        "Fasting sample preferred.", 4, 250.00,
        [
            ("CA_TOTAL", "Total Calcium", "mg/dL", 1, ResultValueTypeEnum.NUMBER, [(None, 8.8, 10.2, "8.8 - 10.2")]),
            ("CA_ION", "Ionized Calcium (Calculated)", "mmol/L", 2, ResultValueTypeEnum.NUMBER, [(None, 1.15, 1.33, "1.15 - 1.33")]),
        ]
    ),
    (
        "BIO", "PHOS", "Serum Phosphorus (Inorganic)", "Phosphorus",
        TestTypeEnum.BIOCHEMISTRY, SampleTypeEnum.SERUM, "Gold Top (SST Vacutainer)",
        "Fasting sample preferred.", 4, 250.00,
        [
            ("PHOSPHATE", "Serum Phosphorus", "mg/dL", 1, ResultValueTypeEnum.NUMBER, [(None, 2.5, 4.5, "2.5 - 4.5")]),
        ]
    ),
    (
        "BIO", "MAGNESIUM", "Serum Magnesium", "Magnesium",
        TestTypeEnum.BIOCHEMISTRY, SampleTypeEnum.SERUM, "Gold Top (SST Vacutainer)",
        "Avoid hemolyzed specimen.", 6, 350.00,
        [
            ("MAGNESIUM", "Serum Magnesium", "mg/dL", 2, ResultValueTypeEnum.NUMBER, [(None, 1.7, 2.4, "1.7 - 2.4")]),
        ]
    ),
    (
        "BIO", "URIC-ACID", "Serum Uric Acid", "Uric Acid",
        TestTypeEnum.BIOCHEMISTRY, SampleTypeEnum.SERUM, "Gold Top (SST Vacutainer)",
        "Overnight fasting recommended. Avoid purine-rich foods.", 4, 200.00,
        [
            ("URIC_ACID", "Serum Uric Acid", "mg/dL", 1, ResultValueTypeEnum.NUMBER, [
                ("MALE", 3.5, 7.2, "3.5 - 7.2"),
                ("FEMALE", 2.6, 6.0, "2.6 - 6.0"),
            ]),
        ]
    ),
    (
        "BIO", "CREATININE", "Serum Creatinine & eGFR", "Creatinine",
        TestTypeEnum.BIOCHEMISTRY, SampleTypeEnum.SERUM, "Gold Top (SST Vacutainer)",
        "Well hydrated. Avoid strenuous workout 24h prior.", 4, 200.00,
        [
            ("CREATININE", "Serum Creatinine", "mg/dL", 2, ResultValueTypeEnum.NUMBER, [
                ("MALE", 0.7, 1.3, "0.7 - 1.3"),
                ("FEMALE", 0.6, 1.1, "0.6 - 1.1"),
            ]),
            ("EGFR", "Estimated GFR (CKD-EPI)", "mL/min/1.73m2", 0, ResultValueTypeEnum.NUMBER, [(None, 90.0, 150.0, "> 90 (Normal)")]),
        ]
    ),
    (
        "BIO", "BUN", "Blood Urea Nitrogen (BUN)", "BUN",
        TestTypeEnum.BIOCHEMISTRY, SampleTypeEnum.SERUM, "Gold Top (SST Vacutainer)",
        "Fasting sample preferred.", 4, 200.00,
        [
            ("BUN", "Blood Urea Nitrogen", "mg/dL", 1, ResultValueTypeEnum.NUMBER, [(None, 7.0, 20.0, "7.0 - 20.0")]),
            ("BUN_RATIO", "BUN / Creatinine Ratio", "ratio", 1, ResultValueTypeEnum.NUMBER, [(None, 10.0, 20.0, "10.0 - 20.0")]),
        ]
    ),
    (
        "BIO", "AMYLASE", "Serum Amylase", "Amylase",
        TestTypeEnum.BIOCHEMISTRY, SampleTypeEnum.SERUM, "Gold Top (SST Vacutainer)",
        "Acute pancreatic evaluation.", 6, 600.00,
        [
            ("AMYLASE", "Serum Amylase", "U/L", 0, ResultValueTypeEnum.NUMBER, [(None, 28.0, 100.0, "28 - 100")]),
        ]
    ),
    (
        "BIO", "LIPASE", "Serum Lipase", "Lipase",
        TestTypeEnum.BIOCHEMISTRY, SampleTypeEnum.SERUM, "Gold Top (SST Vacutainer)",
        "Specific marker for acute pancreatitis.", 6, 750.00,
        [
            ("LIPASE", "Serum Lipase", "U/L", 0, ResultValueTypeEnum.NUMBER, [(None, 13.0, 60.0, "13 - 60")]),
        ]
    ),
    (
        "BIO", "LDH", "Lactate Dehydrogenase (LDH)", "LDH",
        TestTypeEnum.BIOCHEMISTRY, SampleTypeEnum.SERUM, "Gold Top (SST Vacutainer)",
        "Must be free of hemolysis.", 6, 500.00,
        [
            ("LDH", "Total LDH", "U/L", 0, ResultValueTypeEnum.NUMBER, [(None, 140.0, 280.0, "140 - 280")]),
        ]
    ),
    (
        "BIO", "CPK-TOTAL", "Creatine Kinase (CPK Total)", "CPK Total",
        TestTypeEnum.BIOCHEMISTRY, SampleTypeEnum.SERUM, "Gold Top (SST Vacutainer)",
        "Avoid intense workout 24 hours prior.", 6, 550.00,
        [
            ("CPK", "CPK (Total CK)", "U/L", 0, ResultValueTypeEnum.NUMBER, [
                ("MALE", 39.0, 308.0, "39 - 308"),
                ("FEMALE", 26.0, 192.0, "26 - 192"),
            ]),
        ]
    ),
    (
        "BIO", "CK-MB", "Creatine Kinase-MB (Cardiac Isoenzyme)", "CK-MB",
        TestTypeEnum.BIOCHEMISTRY, SampleTypeEnum.SERUM, "Gold Top (SST Vacutainer)",
        "Early myocardial injury marker.", 6, 700.00,
        [
            ("CKMB", "CK-MB Activity", "U/L", 1, ResultValueTypeEnum.NUMBER, [(None, 0.0, 25.0, "< 25.0")]),
        ]
    ),
    (
        "BIO", "TROPONIN-I", "Cardiac Troponin I Quantitative", "Troponin I",
        TestTypeEnum.BIOCHEMISTRY, SampleTypeEnum.SERUM, "Gold Top (SST Vacutainer)",
        "Emergency high-sensitivity cardiac marker.", 2, 1200.00,
        [
            ("TROP_I", "Cardiac Troponin I", "ng/mL", 3, ResultValueTypeEnum.NUMBER, [(None, 0.0, 0.04, "< 0.04")]),
        ]
    ),

    # ----------------------------------------------------
    # HORMONES, VITAMINS & ENDOCRINOLOGY
    # ----------------------------------------------------
    (
        "HOR", "TSH-ULTRA", "TSH (Thyroid Stimulating Hormone Ultra)", "TSH",
        TestTypeEnum.BIOCHEMISTRY, SampleTypeEnum.SERUM, "Gold Top (SST Vacutainer)",
        "Morning draw preferred. Fasting not strictly mandatory.", 6, 300.00,
        [
            ("TSH", "TSH 3rd Generation", "uIU/mL", 2, ResultValueTypeEnum.NUMBER, [(None, 0.35, 4.94, "0.35 - 4.94")]),
        ]
    ),
    (
        "HOR", "FT3-FT4", "Free Thyroid Panel (FT3 & FT4)", "Free T3/T4",
        TestTypeEnum.BIOCHEMISTRY, SampleTypeEnum.SERUM, "Gold Top (SST Vacutainer)",
        "Morning blood draw before taking daily thyroid hormone dose.", 12, 700.00,
        [
            ("FT3", "Free Triiodothyronine (FT3)", "pg/mL", 2, ResultValueTypeEnum.NUMBER, [(None, 1.71, 3.71, "1.71 - 3.71")]),
            ("FT4", "Free Thyroxine (FT4)", "ng/dL", 2, ResultValueTypeEnum.NUMBER, [(None, 0.70, 1.48, "0.70 - 1.48")]),
        ]
    ),
    (
        "HOR", "VIT-D3", "Vitamin D (25-Hydroxy Cholecalciferol)", "Vit D3",
        TestTypeEnum.BIOCHEMISTRY, SampleTypeEnum.SERUM, "Gold Top (SST Vacutainer)",
        "Measures total 25(OH) Vitamin D2 + D3.", 24, 1200.00,
        [
            ("VITD", "25-OH Vitamin D Total", "ng/mL", 1, ResultValueTypeEnum.NUMBER, [(None, 30.0, 100.0, "Deficient <20, Insufficient 20-30, Sufficient 30-100")]),
        ]
    ),
    (
        "HOR", "PROLACTIN", "Serum Prolactin", "Prolactin",
        TestTypeEnum.BIOCHEMISTRY, SampleTypeEnum.SERUM, "Gold Top (SST Vacutainer)",
        "Patient must be awake for 2-3 hours prior to draw. Avoid stress.", 12, 550.00,
        [
            ("PROLACTIN", "Serum Prolactin", "ng/mL", 1, ResultValueTypeEnum.NUMBER, [
                ("MALE", 2.1, 17.7, "2.1 - 17.7"),
                ("FEMALE", 2.8, 29.2, "2.8 - 29.2 (Non-pregnant)"),
            ]),
        ]
    ),
    (
        "HOR", "BETA-HCG", "Beta hCG Total Quantitative", "Beta hCG",
        TestTypeEnum.BIOCHEMISTRY, SampleTypeEnum.SERUM, "Gold Top (SST Vacutainer)",
        "Pregnancy confirmation and gestational dating.", 6, 650.00,
        [
            ("BHCG", "Beta hCG", "mIU/mL", 2, ResultValueTypeEnum.NUMBER, [(None, 0.0, 5.0, "< 5.0 (Non-pregnant)")]),
        ]
    ),
    (
        "HOR", "TESTOSTERONE", "Testosterone Total", "Testosterone",
        TestTypeEnum.BIOCHEMISTRY, SampleTypeEnum.SERUM, "Gold Top (SST Vacutainer)",
        "Draw sample between 7 AM and 10 AM.", 24, 750.00,
        [
            ("TESTO", "Total Testosterone", "ng/dL", 1, ResultValueTypeEnum.NUMBER, [
                ("MALE", 240.0, 870.0, "240 - 870"),
                ("FEMALE", 14.0, 76.0, "14 - 76"),
            ]),
        ]
    ),
    (
        "HOR", "CORTISOL-AM", "Serum Cortisol Morning (8 AM)", "Cortisol AM",
        TestTypeEnum.BIOCHEMISTRY, SampleTypeEnum.SERUM, "Gold Top (SST Vacutainer)",
        "Draw strictly at 8:00 AM after 30 minutes rest.", 12, 600.00,
        [
            ("CORTISOL", "Cortisol Morning", "ug/dL", 2, ResultValueTypeEnum.NUMBER, [(None, 6.7, 22.6, "6.7 - 22.6")]),
        ]
    ),
    (
        "HOR", "AMH", "Anti-Mullerian Hormone (AMH)", "AMH",
        TestTypeEnum.BIOCHEMISTRY, SampleTypeEnum.SERUM, "Gold Top (SST Vacutainer)",
        "Marker of ovarian follicular reserve. Can be done on any cycle day.", 24, 1800.00,
        [
            ("AMH", "AMH", "ng/mL", 2, ResultValueTypeEnum.NUMBER, [(None, 1.0, 4.0, "1.0 - 4.0 (Normal Fertility)")]),
        ]
    ),

    # ----------------------------------------------------
    # SEROLOGY & IMMUNOLOGY
    # ----------------------------------------------------
    (
        "SER", "WIDAL", "Widal Slide Agglutination Test (Typhoid)", "Widal",
        TestTypeEnum.PATHOLOGY, SampleTypeEnum.SERUM, "Gold Top (SST Vacutainer)",
        "Qualitative and semi-quantitative slide test.", 4, 250.00,
        [
            ("TYPHI_O", "S. Typhi (O Antigen Titre)", "", 0, ResultValueTypeEnum.TEXT, [(None, None, None, "< 1:80 (Negative)")]),
            ("TYPHI_H", "S. Typhi (H Antigen Titre)", "", 0, ResultValueTypeEnum.TEXT, [(None, None, None, "< 1:80 (Negative)")]),
            ("PARATYPHI_AH", "S. Paratyphi AH Titre", "", 0, ResultValueTypeEnum.TEXT, [(None, None, None, "< 1:80 (Negative)")]),
            ("PARATYPHI_BH", "S. Paratyphi BH Titre", "", 0, ResultValueTypeEnum.TEXT, [(None, None, None, "< 1:80 (Negative)")]),
        ]
    ),
    (
        "SER", "TYPHIDOT", "Typhidot IgM & IgG Rapid Test", "Typhidot",
        TestTypeEnum.PATHOLOGY, SampleTypeEnum.SERUM, "Gold Top (SST Vacutainer)",
        "Acute and convalescent typhoid antibody detection.", 3, 500.00,
        [
            ("TYPHIDOT_IGM", "Typhidot IgM (Acute Phase)", "", 0, ResultValueTypeEnum.POSITIVE_NEGATIVE, [(None, None, None, "Negative")]),
            ("TYPHIDOT_IGG", "Typhidot IgG (Past Exposure)", "", 0, ResultValueTypeEnum.POSITIVE_NEGATIVE, [(None, None, None, "Negative")]),
        ]
    ),
    (
        "SER", "DENGUE-COMBO", "Dengue Duo Combo (NS1 Ag, IgM, IgG)", "Dengue Duo",
        TestTypeEnum.PATHOLOGY, SampleTypeEnum.SERUM, "Gold Top (SST Vacutainer)",
        "Rapid differential detection of acute and past Dengue infection.", 3, 850.00,
        [
            ("DENGUE_NS1", "Dengue NS1 Antigen", "", 0, ResultValueTypeEnum.POSITIVE_NEGATIVE, [(None, None, None, "Negative")]),
            ("DENGUE_IGM", "Dengue IgM Antibody", "", 0, ResultValueTypeEnum.POSITIVE_NEGATIVE, [(None, None, None, "Negative")]),
            ("DENGUE_IGG", "Dengue IgG Antibody", "", 0, ResultValueTypeEnum.POSITIVE_NEGATIVE, [(None, None, None, "Negative")]),
        ]
    ),
    (
        "SER", "MALARIA-AG", "Malaria Rapid Antigen (Pv & Pf)", "Malaria Ag",
        TestTypeEnum.PATHOLOGY, SampleTypeEnum.WHOLE_BLOOD_EDTA, "Lavender Top (EDTA Vacutainer)",
        "Immunochromatographic detection of pLDH and HRP-2.", 2, 300.00,
        [
            ("MALARIA_PV", "P. vivax Antigen (pLDH)", "", 0, ResultValueTypeEnum.POSITIVE_NEGATIVE, [(None, None, None, "Negative")]),
            ("MALARIA_PF", "P. falciparum Antigen (HRP-2)", "", 0, ResultValueTypeEnum.POSITIVE_NEGATIVE, [(None, None, None, "Negative")]),
        ]
    ),
    (
        "SER", "CRP", "C-Reactive Protein (Quantitative)", "CRP",
        TestTypeEnum.PATHOLOGY, SampleTypeEnum.SERUM, "Gold Top (SST Vacutainer)",
        "Immunoturbidimetric acute inflammatory marker.", 4, 450.00,
        [
            ("CRP_VAL", "C-Reactive Protein (CRP)", "mg/L", 1, ResultValueTypeEnum.NUMBER, [(None, 0.0, 6.0, "< 6.0")]),
        ]
    ),
    (
        "SER", "HS-CRP", "High-Sensitivity CRP (Cardio CRP)", "hs-CRP",
        TestTypeEnum.PATHOLOGY, SampleTypeEnum.SERUM, "Gold Top (SST Vacutainer)",
        "Cardiovascular risk assessment marker.", 6, 800.00,
        [
            ("HSCRP_VAL", "High-Sensitivity CRP", "mg/L", 2, ResultValueTypeEnum.NUMBER, [(None, 0.0, 3.0, "Low Risk <1.0, Average 1.0-3.0, High Risk >3.0")]),
        ]
    ),
    (
        "SER", "RA-FACTOR", "Rheumatoid Factor (RA Quantitative)", "RA Factor",
        TestTypeEnum.PATHOLOGY, SampleTypeEnum.SERUM, "Gold Top (SST Vacutainer)",
        "Turbidimetric autoantibody test for rheumatoid arthritis.", 6, 400.00,
        [
            ("RA_VAL", "Rheumatoid Factor", "IU/mL", 1, ResultValueTypeEnum.NUMBER, [(None, 0.0, 20.0, "< 20.0 (Negative)")]),
        ]
    ),
    (
        "SER", "ASO-TITRE", "Anti-Streptolysin O (ASO Titre)", "ASO",
        TestTypeEnum.PATHOLOGY, SampleTypeEnum.SERUM, "Gold Top (SST Vacutainer)",
        "Quantitative post-streptococcal infection titer.", 6, 450.00,
        [
            ("ASO_VAL", "ASO Titre", "IU/mL", 0, ResultValueTypeEnum.NUMBER, [(None, 0.0, 200.0, "< 200")]),
        ]
    ),
    (
        "SER", "VDRL", "VDRL / RPR Syphilis Serology", "VDRL",
        TestTypeEnum.PATHOLOGY, SampleTypeEnum.SERUM, "Gold Top (SST Vacutainer)",
        "Screening flocculation test for Treponema pallidum.", 4, 200.00,
        [
            ("VDRL_RES", "VDRL / RPR Test", "", 0, ResultValueTypeEnum.TEXT, [(None, None, None, "Non-Reactive")]),
        ]
    ),
    (
        "SER", "HIV-1-2", "HIV 1 & 2 Antibody Screening", "HIV 1/2",
        TestTypeEnum.PATHOLOGY, SampleTypeEnum.SERUM, "Gold Top (SST Vacutainer)",
        "Third generation rapid immunochromatographic assay.", 4, 400.00,
        [
            ("HIV_RES", "HIV 1 & 2 Antibodies", "", 0, ResultValueTypeEnum.TEXT, [(None, None, None, "Non-Reactive")]),
        ]
    ),
    (
        "SER", "HBSAG", "Hepatitis B Surface Antigen (HBsAg)", "HBsAg",
        TestTypeEnum.PATHOLOGY, SampleTypeEnum.SERUM, "Gold Top (SST Vacutainer)",
        "Qualitative viral hepatitis screening.", 4, 350.00,
        [
            ("HBSAG_RES", "HBsAg Antigen", "", 0, ResultValueTypeEnum.TEXT, [(None, None, None, "Non-Reactive")]),
        ]
    ),
    (
        "SER", "HCV", "Hepatitis C Antibody (Anti-HCV)", "HCV",
        TestTypeEnum.PATHOLOGY, SampleTypeEnum.SERUM, "Gold Top (SST Vacutainer)",
        "Qualitative detection of antibodies against HCV.", 4, 500.00,
        [
            ("HCV_RES", "Anti-HCV Antibody", "", 0, ResultValueTypeEnum.TEXT, [(None, None, None, "Non-Reactive")]),
        ]
    ),
    (
        "SER", "ANA-IFA", "Antinuclear Antibodies (ANA Screening)", "ANA",
        TestTypeEnum.PATHOLOGY, SampleTypeEnum.SERUM, "Gold Top (SST Vacutainer)",
        "Gold standard indirect immunofluorescence / ELISA autoantibody test.", 24, 950.00,
        [
            ("ANA_RES", "ANA Qualitative Screen", "", 0, ResultValueTypeEnum.POSITIVE_NEGATIVE, [(None, None, None, "Negative / Titer < 1:40")]),
            ("ANA_PATTERN", "Fluorescence Pattern", "", 0, ResultValueTypeEnum.TEXT, [(None, None, None, "None Seen")]),
        ]
    ),
    (
        "SER", "MANTOUX", "Mantoux Tuberculin Skin Test (5 TU PPD)", "Mantoux",
        TestTypeEnum.PATHOLOGY, SampleTypeEnum.OTHER, "Intradermal Tuberculin PPD",
        "Reading taken at 48 to 72 hours by measuring induration.", 72, 250.00,
        [
            ("MANTOUX_IND", "Induration Diameter", "mm", 1, ResultValueTypeEnum.NUMBER, [(None, 0.0, 5.0, "< 5 mm (Negative), >= 10 mm (Positive)")]),
        ]
    ),

    # ----------------------------------------------------
    # CLINICAL PATHOLOGY & URINALYSIS
    # ----------------------------------------------------
    (
        "URN", "URINE-RM", "Urine Routine & Microscopic Examination", "Urine R/M",
        TestTypeEnum.PATHOLOGY, SampleTypeEnum.URINE_ROUTINE, "Sterile Urine Container",
        "Fresh clean-catch midstream early morning specimen.", 2, 150.00,
        [
            ("U_COLOR", "Color", "", 0, ResultValueTypeEnum.TEXT, [(None, None, None, "Pale Yellow")]),
            ("U_APP", "Appearance / Clarity", "", 0, ResultValueTypeEnum.TEXT, [(None, None, None, "Clear")]),
            ("U_SPGRAV", "Specific Gravity", "", 3, ResultValueTypeEnum.NUMBER, [(None, 1.005, 1.030, "1.005 - 1.030")]),
            ("U_PH", "Reaction (pH)", "", 1, ResultValueTypeEnum.NUMBER, [(None, 5.0, 7.5, "5.0 - 7.5")]),
            ("U_PROT", "Albumin / Protein", "", 0, ResultValueTypeEnum.TEXT, [(None, None, None, "Nil / Negative")]),
            ("U_SUGAR", "Glucose / Sugar", "", 0, ResultValueTypeEnum.TEXT, [(None, None, None, "Nil / Negative")]),
            ("U_KET", "Ketone Bodies", "", 0, ResultValueTypeEnum.TEXT, [(None, None, None, "Negative")]),
            ("U_BLOOD", "Occult Blood", "", 0, ResultValueTypeEnum.TEXT, [(None, None, None, "Negative")]),
            ("U_PUS", "Pus Cells (Leukocytes)", "/hpf", 0, ResultValueTypeEnum.NUMBER, [(None, 0.0, 5.0, "0 - 5 /hpf")]),
            ("U_RBC", "Red Blood Cells (RBCs)", "/hpf", 0, ResultValueTypeEnum.NUMBER, [(None, 0.0, 2.0, "0 - 2 /hpf")]),
            ("U_EPI", "Epithelial Cells", "/hpf", 0, ResultValueTypeEnum.NUMBER, [(None, 0.0, 5.0, "0 - 5 /hpf")]),
            ("U_CASTS", "Casts", "", 0, ResultValueTypeEnum.TEXT, [(None, None, None, "Nil Seen")]),
            ("U_CRYST", "Crystals", "", 0, ResultValueTypeEnum.TEXT, [(None, None, None, "Nil Seen")]),
            ("U_BACT", "Bacteria", "", 0, ResultValueTypeEnum.TEXT, [(None, None, None, "Absent")]),
        ]
    ),
    (
        "URN", "UPT", "Urine Pregnancy Test (UPT Rapid)", "UPT",
        TestTypeEnum.PATHOLOGY, SampleTypeEnum.URINE_ROUTINE, "Clean Plastic Cup",
        "Early morning first voided urine sample gives highest sensitivity.", 1, 150.00,
        [
            ("UPT_RES", "Urine hCG Card Test", "", 0, ResultValueTypeEnum.POSITIVE_NEGATIVE, [(None, None, None, "Negative")]),
        ]
    ),
    (
        "URN", "URINE-ACR", "Urine Microalbumin / Creatinine Ratio", "Urine ACR",
        TestTypeEnum.BIOCHEMISTRY, SampleTypeEnum.URINE_ROUTINE, "Sterile Urine Container",
        "Spot first morning urine sample preferred.", 6, 650.00,
        [
            ("U_MICROALB", "Urine Microalbumin", "mg/L", 1, ResultValueTypeEnum.NUMBER, [(None, 0.0, 20.0, "< 20.0")]),
            ("U_CREAT", "Urine Creatinine", "mg/dL", 1, ResultValueTypeEnum.NUMBER, [(None, 30.0, 300.0, "30 - 300")]),
            ("U_ACR", "Albumin / Creatinine Ratio", "mg/g", 1, ResultValueTypeEnum.NUMBER, [(None, 0.0, 30.0, "< 30 (Normal), 30-300 (Microalbuminuria)")]),
        ]
    ),
    (
        "URN", "URINE-24HR-PRO", "24-Hour Urine Total Protein", "24h Urine Protein",
        TestTypeEnum.BIOCHEMISTRY, SampleTypeEnum.URINE_24HR, "24-Hour Container with Preservative",
        "Discard 1st morning urine, collect all subsequent urine for 24 hours.", 12, 450.00,
        [
            ("U24_VOL", "24-Hour Urine Volume", "mL", 0, ResultValueTypeEnum.NUMBER, [(None, 800.0, 2000.0, "800 - 2000")]),
            ("U24_PROT", "Total Protein Excretion", "mg/24hr", 1, ResultValueTypeEnum.NUMBER, [(None, 50.0, 150.0, "50 - 150")]),
        ]
    ),
    (
        "URN", "STOOL-RM", "Stool Routine & Microscopic Examination", "Stool R/M",
        TestTypeEnum.PATHOLOGY, SampleTypeEnum.STOOL, "Sterile Stool Container",
        "Fresh stool specimen uncontaminated with urine or water.", 4, 200.00,
        [
            ("S_COLOR", "Color", "", 0, ResultValueTypeEnum.TEXT, [(None, None, None, "Brown")]),
            ("S_CONS", "Consistency", "", 0, ResultValueTypeEnum.TEXT, [(None, None, None, "Semi-formed")]),
            ("S_MUCUS", "Mucus", "", 0, ResultValueTypeEnum.TEXT, [(None, None, None, "Absent")]),
            ("S_BLOOD", "Gross Blood", "", 0, ResultValueTypeEnum.TEXT, [(None, None, None, "Absent")]),
            ("S_PUS", "Pus Cells", "/hpf", 0, ResultValueTypeEnum.NUMBER, [(None, 0.0, 2.0, "0 - 2 /hpf")]),
            ("S_RBC", "RBCs", "/hpf", 0, ResultValueTypeEnum.NUMBER, [(None, 0.0, 0.0, "Nil")]),
            ("S_OVA", "Ova & Cysts", "", 0, ResultValueTypeEnum.TEXT, [(None, None, None, "None Seen")]),
        ]
    ),
    (
        "URN", "STOOL-OB", "Stool Occult Blood (FOBT)", "Stool FOBT",
        TestTypeEnum.PATHOLOGY, SampleTypeEnum.STOOL, "Sterile Stool Container",
        "Avoid red meat, iron tonics, and NSAIDs for 48 hours prior.", 2, 250.00,
        [
            ("FOBT_RES", "Occult Blood (FOBT)", "", 0, ResultValueTypeEnum.POSITIVE_NEGATIVE, [(None, None, None, "Negative")]),
        ]
    ),
    (
        "URN", "SEMEN-ANALYSIS", "Semen Examination & Morphology", "Semen Analysis",
        TestTypeEnum.PATHOLOGY, SampleTypeEnum.OTHER, "Wide-Mouth Sterile Container",
        "3 to 5 days strict sexual abstinence prior to collection.", 4, 500.00,
        [
            ("SEM_VOL", "Volume", "mL", 1, ResultValueTypeEnum.NUMBER, [(None, 1.5, 5.0, ">= 1.5")]),
            ("SEM_LIQ", "Liquefaction Time", "minutes", 0, ResultValueTypeEnum.NUMBER, [(None, 15.0, 30.0, "15 - 30")]),
            ("SEM_PH", "pH", "", 1, ResultValueTypeEnum.NUMBER, [(None, 7.2, 8.0, "7.2 - 8.0")]),
            ("SEM_COUNT", "Total Sperm Count", "million/mL", 1, ResultValueTypeEnum.NUMBER, [(None, 15.0, 200.0, ">= 15.0")]),
            ("SEM_MOT", "Total Motility (A+B+C)", "%", 0, ResultValueTypeEnum.NUMBER, [(None, 40.0, 100.0, ">= 40%")]),
            ("SEM_PROG", "Progressive Motility (A+B)", "%", 0, ResultValueTypeEnum.NUMBER, [(None, 32.0, 100.0, ">= 32%")]),
            ("SEM_MORPH", "Normal Sperm Morphology", "%", 0, ResultValueTypeEnum.NUMBER, [(None, 4.0, 100.0, ">= 4% (Kruger)")]),
        ]
    ),

    # ----------------------------------------------------
    # MICROBIOLOGY & CULTURES
    # ----------------------------------------------------
    (
        "MIC", "URINE-CS", "Urine Culture & Antibiotic Sensitivity", "Urine C/S",
        TestTypeEnum.PATHOLOGY, SampleTypeEnum.URINE_ROUTINE, "Sterile Boric Acid Container",
        "Clean catch midstream specimen prior to antibiotic therapy.", 48, 750.00,
        [
            ("U_COLONY", "Colony Count", "CFU/mL", 0, ResultValueTypeEnum.TEXT, [(None, None, None, "No Significant Growth (< 10^4 CFU/mL)")]),
            ("U_ORGANISM", "Organism Isolated", "", 0, ResultValueTypeEnum.TEXT, [(None, None, None, "Sterile after 48h incubation")]),
            ("U_SENSITIVITY", "Antibiotic Susceptibility Profile", "", 0, ResultValueTypeEnum.TEXT, [(None, None, None, "Not Applicable")]),
        ]
    ),
    (
        "MIC", "BLOOD-CS", "Blood Culture & Sensitivity (Automated)", "Blood C/S",
        TestTypeEnum.PATHOLOGY, SampleTypeEnum.WHOLE_BLOOD_EDTA, "Bactec Aerobic Culture Bottle",
        "Draw strictly aseptic sample during temperature spike.", 72, 1200.00,
        [
            ("B_GROWTH", "Blood Culture Status", "", 0, ResultValueTypeEnum.TEXT, [(None, None, None, "Sterile after 5 days incubation")]),
            ("B_ORGANISM", "Isolated Pathogen", "", 0, ResultValueTypeEnum.TEXT, [(None, None, None, "None Seen")]),
        ]
    ),
    (
        "MIC", "SPUTUM-AFB", "Sputum for Acid Fast Bacilli (AFB)", "Sputum AFB",
        TestTypeEnum.PATHOLOGY, SampleTypeEnum.SWAB, "Wide Mouth Sterile Cup",
        "Early morning deep coughed sputum, not saliva.", 6, 250.00,
        [
            ("AFB_STAIN", "ZN Stain for Mycobacterium tuberculosis", "", 0, ResultValueTypeEnum.POSITIVE_NEGATIVE, [(None, None, None, "Negative for AFB")]),
        ]
    ),
    (
        "MIC", "PUS-CS", "Pus Swab Culture & Antibiotic Sensitivity", "Pus C/S",
        TestTypeEnum.PATHOLOGY, SampleTypeEnum.SWAB, "Sterile Transport Swab (Amies)",
        "Clean surrounding wound edge before taking deep swab.", 48, 750.00,
        [
            ("PUS_ORGANISM", "Organism Isolated", "", 0, ResultValueTypeEnum.TEXT, [(None, None, None, "No Pyogenic Organisms Isolated")]),
            ("PUS_SENSITIVITY", "Antibiotic Susceptibility", "", 0, ResultValueTypeEnum.TEXT, [(None, None, None, "Not Applicable")]),
        ]
    ),
    (
        "MIC", "KOH-MOUNT", "Fungus KOH Mount Microscopy", "KOH Mount",
        TestTypeEnum.PATHOLOGY, SampleTypeEnum.SWAB, "Clean Sterile Container / Slide",
        "Clean skin/nail scraping area with 70% alcohol.", 4, 250.00,
        [
            ("KOH_RES", "KOH Wet Mount Examination", "", 0, ResultValueTypeEnum.TEXT, [(None, None, None, "No Fungal Hyphae / Yeast Cells Seen")]),
        ]
    ),

    # ----------------------------------------------------
    # RADIOLOGY & DIAGNOSTIC IMAGING
    # ----------------------------------------------------
    (
        "RAD", "XRAY-CERVICAL", "X-Ray Cervical Spine AP & Lateral Views", "X-Ray C-Spine",
        TestTypeEnum.RADIOLOGY, SampleTypeEnum.IMAGING, "Digital X-Ray Suite (CR/DR)",
        "Remove metallic jewelry, necklaces, and hair clips.", 4, 600.00,
        []
    ),
    (
        "RAD", "XRAY-LUMBAR", "X-Ray Lumbar Spine AP & Lateral Views", "X-Ray L-Spine",
        TestTypeEnum.RADIOLOGY, SampleTypeEnum.IMAGING, "Digital X-Ray Suite (CR/DR)",
        "Remove metallic belt buckles and pocket items.", 4, 600.00,
        []
    ),
    (
        "RAD", "XRAY-KNEE", "X-Ray Both Knee Joints AP Standing", "X-Ray Knees",
        TestTypeEnum.RADIOLOGY, SampleTypeEnum.IMAGING, "Digital X-Ray Suite (CR/DR)",
        "Wear loose comfortable clothing.", 4, 600.00,
        []
    ),
    (
        "RAD", "XRAY-PNS", "X-Ray Paranasal Sinuses (Water's View)", "X-Ray PNS",
        TestTypeEnum.RADIOLOGY, SampleTypeEnum.IMAGING, "Digital X-Ray Suite (CR/DR)",
        "Remove spectacles, dentures, and earrings.", 4, 500.00,
        []
    ),
    (
        "RAD", "USG-PELVIS", "Ultrasound Pelvis (KUB / Gynae)", "USG Pelvis",
        TestTypeEnum.RADIOLOGY, SampleTypeEnum.IMAGING, "High-Resolution Sonography",
        "Full urinary bladder required. Drink 1 liter water 1 hour prior.", 4, 900.00,
        []
    ),
    (
        "RAD", "USG-OBS", "Ultrasound Obstetric / Antenatal Scan", "USG Obstetric",
        TestTypeEnum.RADIOLOGY, SampleTypeEnum.IMAGING, "Obstetric Ultrasound Suite",
        "Full bladder for early pregnancy; moderate filling for 2nd/3rd trimester.", 4, 1400.00,
        []
    ),
    (
        "RAD", "USG-THYROID", "Ultrasound Neck & Thyroid Gland", "USG Thyroid",
        TestTypeEnum.RADIOLOGY, SampleTypeEnum.IMAGING, "High-Frequency Linear Ultrasound",
        "Expose neck region. Remove necklaces.", 4, 1100.00,
        []
    ),
    (
        "RAD", "USG-SCROTUM", "Scrotal Sonography & Color Doppler", "USG Scrotum",
        TestTypeEnum.RADIOLOGY, SampleTypeEnum.IMAGING, "Color Doppler Workstation",
        "No special preparation required.", 4, 1500.00,
        []
    ),

    # ----------------------------------------------------
    # CARDIOLOGY & PULMONOLOGY
    # ----------------------------------------------------
    (
        "CAR", "ECHO-2D", "2D Echocardiography with Color Doppler", "2D Echo",
        TestTypeEnum.CARDIOLOGY, SampleTypeEnum.IMAGING, "Cardiac Ultrasound System",
        "Rest comfortably for 10 minutes prior to exam.", 4, 1800.00,
        []
    ),
    (
        "CAR", "TMT", "Treadmill Stress Test (TMT / Stress ECG)", "TMT",
        TestTypeEnum.CARDIOLOGY, SampleTypeEnum.IMAGING, "Computerized Stress System",
        "Wear comfortable shoes. Light meal 2 hours prior; avoid smoking/caffeine.", 4, 1500.00,
        []
    ),
    (
        "CAR", "PFT", "Pulmonary Function Test (Spirometry)", "PFT",
        TestTypeEnum.OTHER, SampleTypeEnum.OTHER, "Computerized Spirometer",
        "Avoid bronchodilator inhalers 4-6 hours prior if advised by doctor.", 4, 800.00,
        []
    ),
]

PACKAGES_DATA = [
    (
        "PKG-DIABETES", "Comprehensive Diabetic Health Care Package",
        "Full metabolic screening covering Fasting Sugar, PP Sugar, HbA1c, Lipid Profile, Kidney Function, and Urine R/M.",
        Decimal("1499.00"), Decimal("35.00"),
        ["FBS", "PPBS", "HBA1C", "LIPID", "KFT", "URINE-RM"],
    ),
    (
        "PKG-HEART", "Executive Cardiac Risk Evaluation Panel",
        "Cardiovascular wellness screening with Lipid Profile, ECG 12-Lead, Troponin I, CBC, and Fasting Blood Sugar.",
        Decimal("1699.00"), Decimal("30.00"),
        ["LIPID", "ECG-12", "TROPONIN-I", "CBC", "FBS"],
    ),
    (
        "PKG-SENIOR", "Senior Citizen Comprehensive Health Package",
        "Complete annual diagnostic checkup covering CBC, LFT, KFT, Lipid Profile, HbA1c, Thyroid, Calcium, and Urine R/M.",
        Decimal("2499.00"), Decimal("40.00"),
        ["CBC", "LFT", "KFT", "LIPID", "HBA1C", "THYROID", "CALCIUM", "URINE-RM"],
    ),
    (
        "PKG-FEVER", "Acute Fever & Infection Investigation Panel",
        "Immediate differential screening for fevers: CBC, ESR, Widal, Dengue Combo, Malaria Ag, and Urine R/M.",
        Decimal("1299.00"), Decimal("35.00"),
        ["CBC", "ESR", "WIDAL", "DENGUE-COMBO", "MALARIA-AG", "URINE-RM"],
    ),
    (
        "PKG-WOMEN", "Women's Wellness & PCOD Screening Panel",
        "Specialized endocrine and imaging panel covering CBC, Thyroid, Prolactin, Fasting Sugar, and Pelvic Sonography.",
        Decimal("2999.00"), Decimal("30.00"),
        ["CBC", "THYROID", "PROLACTIN", "FBS", "USG-PELVIS"],
    ),
]


async def seed_all_tests():
    print("🚀 Seeding All Standard Diagnostic Tests into local Apex project...")
    async with AsyncSessionLocal() as session:
        # 1. Categories
        cat_map = {}
        for code, name, desc, order in CATEGORIES_DATA:
            res = await session.execute(select(TestCategory).where(TestCategory.code == code))
            cat = res.scalar_one_or_none()
            if not cat:
                cat = TestCategory(
                    code=code,
                    name=name,
                    description=desc,
                    display_order=order,
                    is_active=True,
                )
                session.add(cat)
                await session.flush()
                print(f"  [+] Created Category: {code} - {name}")
            else:
                print(f"  [.] Category already exists: {code}")
            cat_map[code] = cat

        # 2. Tests
        tests_added = 0
        params_added = 0
        ranges_added = 0

        for t_cat_code, t_code, t_name, t_short, t_type, t_sample, t_container, t_prep, t_tat, t_price, params in TESTS_DATA:
            cat = cat_map.get(t_cat_code)
            if not cat:
                continue

            res = await session.execute(select(Test).where(Test.code == t_code))
            test = res.scalar_one_or_none()

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
                tests_added += 1

                for p_order, (p_code, p_name, p_unit, p_prec, p_val_type, ranges) in enumerate(params, start=1):
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
                    params_added += 1

                    for gender, min_val, max_val, disp_str in ranges:
                        rr = TestReferenceRange(
                            parameter_id=param.id,
                            gender=gender,
                            min_value=Decimal(str(min_val)) if min_val is not None else None,
                            max_value=Decimal(str(max_val)) if max_val is not None else None,
                            display_range_string=disp_str,
                        )
                        session.add(rr)
                        ranges_added += 1
            else:
                pass

        print(f"✅ Added {tests_added} new tests, {params_added} parameters, {ranges_added} reference ranges.")

        # 3. Packages
        pkgs_added = 0
        for pkg_code, pkg_name, pkg_desc, pkg_price, pkg_disc, item_codes in PACKAGES_DATA:
            res = await session.execute(select(TestPackage).where(TestPackage.code == pkg_code))
            pkg = res.scalar_one_or_none()
            if not pkg:
                pkg = TestPackage(
                    code=pkg_code,
                    name=pkg_name,
                    description=pkg_desc,
                    price=pkg_price,
                    discount_percentage=pkg_disc,
                    is_active=True,
                )
                session.add(pkg)
                await session.flush()
                pkgs_added += 1

                for icode in item_codes:
                    t_res = await session.execute(select(Test).where(Test.code == icode))
                    t_obj = t_res.scalar_one_or_none()
                    if t_obj:
                        session.add(TestPackageItem(package_id=pkg.id, test_id=t_obj.id))
                print(f"  [+] Created Health Package: {pkg_code} - {pkg_name}")
            else:
                print(f"  [.] Health Package already exists: {pkg_code}")

        await session.commit()
        print(f"🎉 Total Health Packages added: {pkgs_added}")
        print("✨ Database successfully seeded with all standard diagnostic laboratory tests!")

if __name__ == "__main__":
    asyncio.run(seed_all_tests())
