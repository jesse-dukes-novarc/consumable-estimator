import React, { useState } from "react";
import logo from "./novarc-logo.svg";
import jointDiagram from './Joint.png';
import { Analytics } from "@vercel/analytics/next";

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
    bevelAngle: "", 
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
      wireDiameter
    } = form;

    if (!nps || !schedule || !PIPE_DATA[nps] || !PIPE_DATA[nps][schedule]) {
      alert("Please select a valid Pipe Size and Schedule.");
      return;
    }

    const PI = Math.PI;
    const INCH_TO_MM = 25.4;
    const STEEL_DENSITY = 0.00000805; // Density in kg/mm³

    // 1. Calculate Base V-Groove Area
    let CSA_mm2 = (prepDepth_mm * Math.tan(alpha) * prepDepth_mm) + (rg_mm * wallThickness_mm);

    // 2. Determine ASME B31.3 Max Cap & Root Limits based on Wall Thickness
    // B31.3 Table 341.3.2 uses the same allowable limits for both cap reinforcement and internal protrusion.
    let maxProtrusion_mm = 0;
    if (wallThickness_mm <= 6.4) maxProtrusion_mm = 1.5;
    else if (wallThickness_mm <= 12.7) maxProtrusion_mm = 3.0;
    else if (wallThickness_mm <= 25.4) maxProtrusion_mm = 4.0;
    else maxProtrusion_mm = 5.0;

    // 3. Calculate Cap Width (Groove top width + 3mm total overlap)
    const capWidth_mm = 2 * (prepDepth_mm * Math.tan(alpha)) + rg_mm + 3.0;

    // 4. Calculate Parabolic Cap Area
    const capArea_mm2 = (2/3) * capWidth_mm * maxProtrusion_mm;

    // 5. Calculate Root Penetration Area (Half-Circle)
    // Using maxProtrusion_mm as the radius (r) of the half circle
    const rootArea_mm2 = 0.5 * Math.PI * Math.pow(maxProtrusion_mm, 2);

    // 6. Total Cross Sectional Area
    CSA_mm2 = CSA_mm2 + capArea_mm2 + rootArea_mm2;

    // 7. Calculate Wire Length Required & Clipping Waste
    const wd_in = parseFloat(wireDiameter);
    let wireLength_in = 0;
    
    if (!isNaN(wd_in) && wd_in > 0) {
      const wd_mm = wd_in * INCH_TO_MM;
      
      // Cross-sectional area of a single wire: pi * (r^2)
      let wireCSA_mm2 = Math.PI * Math.pow(wd_mm / 2, 2);
      
      // Double the effective area for Hyperfill
      if (processType === "MIG Hyperfill ~90%") {
        wireCSA_mm2 *= 2;
      }
      
      // Length = Volume / Area
      let wireLength_mm = wireVolume_mm3 / wireCSA_mm2;
      wireLength_in = wireLength_mm / INCH_TO_MM; 
      
      // ADD CLIPPING WASTE: 0.5 inches per joint
      wireLength_in += 0.5;
      
      // Recalculate total volume per joint to include the clipped waste
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
      mass_kg: mass_kg,
      mass_lbs: mass_lbs,
      totalMass_kg: totalMass_kg,
      totalMass_lbs: totalMass_lbs,
      wireLength_in: wireLength_in,
      totalWireLength_in: totalWireLength_in,
      numJoints: numJoints,
      od_in: actualOD_in,
      od_mm: actualOD_mm,
      thickness_in: wallThickness_in,
      thickness_mm: wallThickness_mm,
      circumference_mm: circumference_mm
    });
  };

  const processTypes = [
    "TIG ~94%",
    "MIG ~96%",
    "MIG Hyperfill ~90%"
  ];

  const schedules = ["SCH 10", "SCH 40", "SCH 80"];

  return (
  <div className="p-4 max-w-5xl mx-auto">
    <div className="flex items-center gap-4 mb-4">
      <img src={logo} alt="Company Logo" style={{ height: "40px", maxWidth: "180px", objectFit: "contain" }} />
      <h1 className="text-2xl font-bold">SWR Consumable Estimator</h1>
    </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="col-span-2 md:col-span-2">
          
          <h2 className="font-semibold mb-2">Pipe & Process Selection</h2>
          <div className="flex gap-2 mb-2">
            <select name="nps" onChange={handleChange} className="border p-2 w-1/2">
              <option value="">Select Pipe Size (OD)</option>
              {Object.keys(PIPE_DATA).map((size) => (
                <option key={size} value={size}>{size}"</option>
              ))}
            </select>
            <select name="schedule" onChange={handleChange} className="border p-2 w-1/2">
              <option value="">Select Schedule</option>
              {schedules.map((sch) => (
                <option key={sch} value={sch}>{sch}</option>
              ))}
            </select>
          </div>

          <select name="processType" onChange={handleChange} className="border p-2 w-full mb-2">
            <option value="">Select Process Type</option>
            {processTypes.map((pt) => (
              <option key={pt} value={pt}>{pt}</option>
            ))}
          </select>

          <select name="wireDiameter" onChange={handleChange} className="border p-2 w-full mb-4">
            <option value="">Select Wire Diameter</option>
            {WIRE_OPTIONS.map((wire) => (
              <option key={wire.label} value={wire.value}>{wire.label}</option>
            ))}
          </select>

          <h2 className="font-semibold mb-2">Groove Dimensions (Metric)</h2>
          <input name="rootGap" placeholder="Root Gap (mm)" onChange={handleChange} className="border p-2 w-full mb-2" />
          <input name="rootFace" placeholder="Root Face (mm)" onChange={handleChange} className="border p-2 w-full mb-2" />
          <input name="bevelAngle" placeholder="Bevel Angle Per Side (deg)" onChange={handleChange} className="border p-2 w-full mb-2" />

          <div className="my-4 text-center">
            <img 
              src={jointDiagram} 
              alt="Single V-Groove Joint Geometry Diagram showing Root Face, Root Gap, and Bevel Angle" 
             style={{ 
               maxHeight: "220px", 
               width: "auto", 
               margin: "0 auto", 
               borderRadius: "6px",
               border: "1px solid #e5e7eb"
             }} 
           />
         </div>

          <h2 className="font-semibold mt-4 mb-2">Fit Correction</h2>
          <select name="fitUp" onChange={handleChange} className="border p-2 w-full mb-2">
            <option value="Exact Fit (1.0 Correction)">Exact Fit (1.0 Correction)</option>
            <option value="Good Fit (1.05 Correction)">Good Fit (1.05 Correction)</option>
            <option value="Bad Fit (1.10 Correction)">Bad Fit (1.10 Correction)</option>
          </select>

          <h2 className="font-semibold mt-4 mb-2">Number of Joints</h2>
          <input name="numberOfJoints" type="number" min="1" placeholder="Number of Joints" value={form.numberOfJoints} onChange={handleChange} className="border p-2 w-full mb-2" />
        </div>
      </div>

      <button onClick={handleCalculate} className="mt-6 px-4 py-2 bg-blue-600 text-white font-semibold rounded hover:bg-blue-700 transition">
        Calculate Consumables
      </button>

      {result !== null && (
        <div className="mt-6 p-4 bg-gray-50 border rounded-lg max-w-md">
          <h2 className="text-xl font-bold mb-3 border-b pb-2">Calculation Output</h2>
          <ul className="space-y-2 text-lg">
            <li>
              <strong>Pipe OD:</strong> {result.od_in}" 
              <span className="text-gray-500 text-sm ml-2">({result.od_mm.toFixed(1)} mm)</span>
            </li>
            <li>
              <strong>Wall Thickness:</strong> {result.thickness_in}" 
              <span className="text-gray-500 text-sm ml-2">({result.thickness_mm.toFixed(2)} mm)</span>
            </li>
            <li><strong>Weld Length (Circumference):</strong> {result.circumference_mm.toFixed(1)} mm</li>
            
            <div className="mt-4 pt-3 border-t border-gray-300">
              <h3 className="font-bold text-gray-700 uppercase text-sm tracking-wider mb-2">Per Joint (Includes 0.5" Waste)</h3>
              {result.wireLength_in > 0 && (
                <li className="text-green-700">
                  <strong>Wire Length:</strong> {result.wireLength_in.toFixed(1)} inches
                </li>
              )}
              <li className={result.wireLength_in > 0 ? "text-blue-700" : "text-blue-700"}>
                <strong>Wire Mass:</strong> {result.mass_lbs.toFixed(3)} lbs <span className="text-sm text-gray-500">({result.mass_kg.toFixed(3)} kg)</span>
              </li>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-300">
              <h3 className="font-bold text-gray-700 uppercase text-sm tracking-wider mb-2">Total for {result.numJoints} {result.numJoints === 1 ? 'Joint' : 'Joints'}</h3>
              {result.totalWireLength_in > 0 && (
                <li className="text-green-700 font-semibold">
                  <strong>Total Wire Length:</strong> {result.totalWireLength_in.toFixed(1)} inches
                </li>
              )}
              <li className="text-blue-700 font-semibold">
                <strong>Total Wire Mass:</strong> {result.totalMass_lbs.toFixed(3)} lbs <span className="text-sm font-normal text-gray-500">({result.totalMass_kg.toFixed(3)} kg)</span>
              </li>
            </div>
          </ul>
        </div>
      )}
    </div>
  );
}
