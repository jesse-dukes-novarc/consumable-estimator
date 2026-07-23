import React, { useState } from "react";
import logo from "./novarc-logo.svg";
import jointDiagram from './Joint.png';

// Standard Pipe Dimensions Dictionary (OD in inches, Wall Thickness in inches)
const PIPE_DATA = {
  "2": { OD: 2.375, "SCH 10": 0.109, "SCH 40": 0.154, "SCH 80": 0.218 },
  "4": { OD: 4.500, "SCH 10": 0.120, "SCH 40": 0.237, "SCH 80": 0.337 },
  "6": { OD: 6.625, "SCH 10": 0.134, "SCH 40": 0.280, "SCH 80": 0.432 },
  "8": { OD: 8.625, "SCH 10": 0.148, "SCH 40": 0.322, "SCH 80": 0.500 },
  "10": { OD: 10.750, "SCH 10": 0.165, "SCH 40": 0.365, "SCH 80": 0.594 },
  "12": { OD: 12.750, "SCH 10": 0.180, "SCH 40": 0.406, "SCH 80": 0.688 },
  "24": { OD: 24.000, "SCH 10": 0.250, "SCH 40": 0.688, "SCH 80": 1.219 }
};

// Standard Wire Diameters
const WIRE_OPTIONS = [
  { label: '0.03"', value: 0.03 },
  { label: '0.035"', value: 0.035 },
  { label: '0.04"', value: 0.04 },
  { label: '0.045"', value: 0.045 },
  { label: '3/64"', value: 0.046875 },
  { label: '0.052"', value: 0.052 },
  { label: '0.062 (1/16)"', value: 0.0625 },
  { label: '0.078 (5/64)"', value: 0.078125 },
  { label: '0.093 (3/32)"', value: 0.09375 }
];

export default function App() {
  const [form, setForm] = useState({
    nps: "",
    schedule: "",
    processType: "",
    rootGap: "",
    rootFace: "",
    bevelAngleLeft: "30",
    bevelAngleRight: "30", 
    wireDiameter: "",
    fitUp: "Exact Fit (1.0 Correction)",
    numberOfJoints: "1",
  });

  const [result, setResult] = useState(null);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleCalculate = () => {
    const {
      nps,
      schedule,
      processType,
      rootGap,
      rootFace,
      bevelAngle,
      fitUp,
      wireDiameter,
      numberOfJoints
    } = form;

    if (!nps || !schedule || !PIPE_DATA[nps] || !PIPE_DATA[nps][schedule]) {
      alert("Please select a valid Pipe Size and Schedule.");
      return;
    }

    const INCH_TO_MM = 25.4;
    const STEEL_DENSITY = 0.00000805; // Density in kg/mm³

    // Extract Pipe Data
    const actualOD_in = PIPE_DATA[nps].OD;
    const actualOD_mm = actualOD_in * INCH_TO_MM;
    const wallThickness_in = PIPE_DATA[nps][schedule];
    const wallThickness_mm = wallThickness_in * INCH_TO_MM;
    const circumference_mm = Math.PI * actualOD_mm;

    // Extract & Parse Joint Geometry
    const rg_mm = parseFloat(rootGap) || 0;
    const rf_mm = parseFloat(rootFace) || 0;
    
    // Parse left and right bevel angles (defaulting to 30 deg each if left blank)
    const bevel_deg_left = parseFloat(form.bevelAngleLeft) || 30;
    const bevel_deg_right = parseFloat(form.bevelAngleRight) || 30;
    
    // Convert both angles to radians
    const alpha1 = (bevel_deg_left * Math.PI) / 180;
    const alpha2 = (bevel_deg_right * Math.PI) / 180;

    // Preparation depth (Wall thickness minus root face)
    const prepDepth_mm = Math.max(0, wallThickness_mm - rf_mm);

    // Calculate individual groove widths for each side
    const grooveWidthLeft_mm = prepDepth_mm * Math.tan(alpha1);
    const grooveWidthRight_mm = prepDepth_mm * Math.tan(alpha2);

    // 1. Calculate Base V-Groove Area (mm²)
    // Area = (Left Triangle) + (Right Triangle) + (Root Gap Rectangle)
    const leftTriangleArea = 0.5 * prepDepth_mm * grooveWidthLeft_mm;
    const rightTriangleArea = 0.5 * prepDepth_mm * grooveWidthRight_mm;
    const rootGapArea = rg_mm * wallThickness_mm;

    let CSA_mm2 = leftTriangleArea + rightTriangleArea + rootGapArea;

    // 2. Determine ASME B31.3 Max Cap & Root Limits
    let maxProtrusion_mm = 1.5;
    if (wallThickness_mm > 25.4) maxProtrusion_mm = 5.0;
    else if (wallThickness_mm > 12.7) maxProtrusion_mm = 4.0;
    else if (wallThickness_mm > 6.4) maxProtrusion_mm = 3.0;

    // 3. Calculate Total Cap Width (Left Width + Right Width + Root Gap + 3mm Overlap)
    const capWidth_mm = grooveWidthLeft_mm + grooveWidthRight_mm + rg_mm + 3.0;

    // 4. Calculate Parabolic Cap Area
    const capArea_mm2 = (2 / 3) * capWidth_mm * maxProtrusion_mm;

    // 5. Calculate Root Penetration Area
    const rootArea_mm2 = 0.5 * Math.PI * Math.pow(maxProtrusion_mm, 2);

    // 6. Total Cross-Sectional Area
    CSA_mm2 = CSA_mm2 + capArea_mm2 + rootArea_mm2;

    // Fit-up Factor
    let fitFactor = 1.0;
    if (fitUp.includes("1.05")) fitFactor = 1.05;
    if (fitUp.includes("1.10")) fitFactor = 1.10;

    // Calculate Initial Wire Volume Required per Joint (mm³)
    let wireVolume_mm3 = CSA_mm2 * circumference_mm * fitFactor;

    // Process Deposition Efficiency Factor
    let efficiency = 0.96; // Default MIG ~96%
    if (processType === "TIG ~94%") efficiency = 0.94;
    if (processType === "MIG Hyperfill ~90%") efficiency = 0.90;

    // Adjust volume required based on deposition efficiency
    wireVolume_mm3 = wireVolume_mm3 / efficiency;

    // 7. Calculate Wire Length Required & Clipping Waste
    const wd_in = parseFloat(wireDiameter);
    let wireLength_in = 0;
    
    if (!isNaN(wd_in) && wd_in > 0) {
      const wd_mm = wd_in * INCH_TO_MM;
      
      let wireCSA_mm2 = Math.PI * Math.pow(wd_mm / 2, 2);
      
      if (processType === "MIG Hyperfill ~90%") {
        wireCSA_mm2 *= 2;
      }
      
      let wireLength_mm = wireVolume_mm3 / wireCSA_mm2;
      wireLength_in = wireLength_mm / INCH_TO_MM; 
      
      // ADD CLIPPING WASTE: 0.5 inches per joint
      wireLength_in += 0.5;
      
      // Recalculate total volume per joint including waste
      wireLength_mm = wireLength_in * INCH_TO_MM;
      wireVolume_mm3 = wireCSA_mm2 * wireLength_mm; 
    }

    // 8. Calculate Final Mass (Per Joint)
    const mass_kg = wireVolume_mm3 * STEEL_DENSITY;
    const mass_lbs = mass_kg * 2.20462;

    // 9. Calculate Set Totals
    const numJoints = parseInt(numberOfJoints) || 1;
    const totalMass_kg = mass_kg * numJoints;
    const totalMass_lbs = mass_lbs * numJoints;
    const totalWireLength_in = wireLength_in * numJoints;

    setResult({
      mass_kg,
      mass_lbs,
      totalMass_kg,
      totalMass_lbs,
      wireLength_in,
      totalWireLength_in,
      numJoints,
      od_in: actualOD_in,
      od_mm: actualOD_mm,
      thickness_in: wallThickness_in,
      thickness_mm: wallThickness_mm,
      circumference_mm
    });
  };

  const processTypes = [
    "TIG ~94%",
    "MIG ~96%",
    "MIG Hyperfill ~90%"
  ];

  const schedules = ["SCH 10", "SCH 40", "SCH 80"];

  return (
    <div className="min-h-screen bg-white p-4 md:p-8 font-sans text-black">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* --- HEADER SECTION --- */}
        <div className="mb-6">
          <img 
            src={logo} 
            alt="Company Logo" 
            style={{ height: "40px", maxWidth: "180px", objectFit: "contain" }} 
            className="mb-4" 
          />
          <h1 className="inline-block text-2xl md:text-3xl font-bold border-2 border-blue-500 rounded-lg px-4 py-1">
            SWR Consumable Estimator
          </h1>
        </div>

        {/* --- MAIN TWO-COLUMN GRID --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* ======================================================== */}
          {/* 1. LEFT PANEL CARD (Inputs) - Spans 2 Columns            */}
          {/* ======================================================== */}
          <div className="lg:col-span-2 border-2 border-blue-500 rounded-[2.5rem] p-6 md:p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              
              {/* Left Side: Pipe & Groove Inputs */}
              <div className="md:col-span-2 space-y-6">
                
                {/* Pipe & Process Selection */}
                <div>
                  <h2 className="text-xl font-bold mb-3">Pipe & Process Selection</h2>
                  
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <select name="nps" onChange={handleChange} className="border border-gray-400 rounded p-2 text-sm bg-white w-full">
                      <option value="">Select Pipe Size (OD)</option>
                      {Object.keys(PIPE_DATA).map((size) => (
                        <option key={size} value={size}>{size}"</option>
                      ))}
                    </select>

                    <select name="schedule" onChange={handleChange} className="border border-gray-400 rounded p-2 text-sm bg-white w-full">
                      <option value="">Select Schedule</option>
                      {schedules.map((sch) => (
                        <option key={sch} value={sch}>{sch}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <select name="processType" onChange={handleChange} className="border border-gray-400 rounded p-2 text-sm bg-white w-full">
                      <option value="">Select Process Type</option>
                      {processTypes.map((pt) => (
                        <option key={pt} value={pt}>{pt}</option>
                      ))}
                    </select>

                    <select name="wireDiameter" onChange={handleChange} className="border border-gray-400 rounded p-2 text-sm bg-white w-full">
                      <option value="">Select Wire Diameter</option>
                      {WIRE_OPTIONS.map((wire) => (
                        <option key={wire.label} value={wire.value}>{wire.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Groove Dimensions */}
                <div>
                  <h2 className="text-xl font-bold mb-3">Groove Dimensions (Metric)</h2>
                  
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <input 
                      name="rootGap" 
                      placeholder="Root Gap (mm)" 
                      value={form.rootGap} 
                      onChange={handleChange} 
                      className="border border-gray-400 rounded p-2 text-sm w-full" 
                    />
                    <input 
                      name="rootFace" 
                      placeholder="Root Face (mm)" 
                      value={form.rootFace} 
                      onChange={handleChange} 
                      className="border border-gray-400 rounded p-2 text-sm w-full" 
                    />
                  </div>

                  <h3 className="font-bold text-md mb-2">Bevel Angles (Degrees)</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <input 
                      name="bevelAngleLeft" 
                      placeholder="Left Bevel Angle (deg)" 
                      value={form.bevelAngleLeft} 
                      onChange={handleChange} 
                      className="border border-gray-400 rounded p-2 text-sm w-full" 
                    />
                    <input 
                      name="bevelAngleRight" 
                      placeholder="Right Bevel Angle (deg)" 
                      value={form.bevelAngleRight} 
                      onChange={handleChange} 
                      className="border border-gray-400 rounded p-2 text-sm w-full" 
                    />
                  </div>
                </div>

                {/* Joint Diagram */}
                <div className="pt-2 text-center">
                  <img 
                    src={jointDiagram} 
                    alt="Single V-Groove Joint Geometry Diagram" 
                    style={{ maxHeight: "200px", width: "auto", margin: "0 auto", borderRadius: "6px" }} 
                  />
                </div>

              </div>

              {/* Right Side: Fit, Joints, & Button */}
              <div className="md:col-span-1 flex flex-col justify-between space-y-6">
                <div>
                  <h2 className="text-xl font-bold mb-2">Fit Correction</h2>
                  <select name="fitUp" onChange={handleChange} className="border border-gray-400 rounded p-2 w-full text-sm bg-white mb-6">
                    <option value="Exact Fit (1.0 Correction)">Exact Fit (1.0 Correction)</option>
                    <option value="Good Fit (1.05 Correction)">Good Fit (1.05 Correction)</option>
                    <option value="Bad Fit (1.10 Correction)">Bad Fit (1.10 Correction)</option>
                  </select>

                  <h2 className="text-xl font-bold mb-2">Number of Joints</h2>
                  <input 
                    name="numberOfJoints" 
                    type="number" 
                    min="1" 
                    placeholder="Number of Joints" 
                    value={form.numberOfJoints} 
                    onChange={handleChange} 
                    className="border border-gray-400 rounded p-2 w-full text-sm mb-6" 
                  />

                  <button 
                    onClick={handleCalculate} 
                    className="w-full bg-gray-200 border border-gray-400 text-black font-semibold py-2 px-4 rounded shadow-sm hover:bg-gray-300 transition"
                  >
                    Calculate Consumables
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* ======================================================== */}
          {/* 2. RIGHT PANEL CARD (Outputs) - Spans 1 Column           */}
          {/* ======================================================== */}
          <div className="lg:col-span-1 border-2 border-blue-500 rounded-[2.5rem] p-6 md:p-8 min-h-87.5">
            <h2 className="text-xl font-bold mb-4 border-b pb-2">Calculation Output</h2>
            
            {result !== null ? (
              <div className="space-y-6 text-sm">
                <div>
                  <h3 className="font-bold text-base mb-2">Per Joint</h3>
                  <ul className="list-disc list-inside space-y-1">
                    {result.wireLength_in > 0 && (
                      <li>
                        <strong>Wire Length:</strong> {result.wireLength_in.toFixed(1)} inches
                      </li>
                    )}
                    <li>
                      <strong>Wire Mass:</strong> {result.mass_lbs.toFixed(3)} lbs{" "}
                      <span className="text-gray-500">({result.mass_kg.toFixed(3)} kg)</span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-bold text-base mb-2">
                    Total for {result.numJoints} {result.numJoints === 1 ? 'Joint' : 'Joints'}
                  </h3>
                  <ul className="list-disc list-inside space-y-1">
                    {result.totalWireLength_in > 0 && (
                      <li>
                        <strong>Total Wire Length:</strong> {result.totalWireLength_in.toFixed(1)} inches
                      </li>
                    )}
                    <li>
                      <strong>Total Wire Mass:</strong> {result.totalMass_lbs.toFixed(3)} lbs{" "}
                      <span className="text-gray-500">({result.totalMass_kg.toFixed(3)} kg)</span>
                    </li>
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-gray-400 italic text-sm mt-4">
                Fill in the details and click "Calculate Consumables" to see results.
              </p>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
