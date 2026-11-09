import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How it works — EV Battery Health Estimator",
  description: "The electrochemical model, assumptions and limitations behind the battery health estimate.",
};

export default function About() {
  return (
    <article className="card prose">
      <h1>How the estimate works</h1>
      <p>
        Instead of a simple rule of thumb, each estimate runs an electrochemical battery model built with{" "}
        <a href="https://pybamm.org" target="_blank" rel="noopener noreferrer">PyBaMM</a>, an open-source
        battery modelling library.
      </p>
      <h2>1. A representative day</h2>
      <p>
        Your daily distance, vehicle efficiency and charger power become one day of use: driving
        (discharge), parking (rest) and charging. Rates are expressed relative to pack size (C-rates), so the
        same model works for a hatchback or a city bus.
      </p>
      <h2>2. A full simulated year</h2>
      <p>
        The model simulates 365 of those days. The temperature changes month by month for your climate. With
        thermal management on, the pack is kept between 15 and 30 °C while driving and charging, but sits
        at outside temperature while parked.
      </p>
      <h2>3. The degradation physics</h2>
      <ul>
        <li><strong>SEI growth</strong> — a film on the graphite electrode slowly consumes lithium. It speeds up
          with heat and high state of charge.</li>
        <li><strong>Lithium plating</strong> — metallic lithium deposits during fast or cold charging, part of
          which is lost permanently.</li>
      </ul>
      <h2>4. Projecting forward</h2>
      <p>
        The first-year lithium loss is fitted with a square-root-of-time term (typical of SEI growth) plus a
        linear term (per-cycle damage). That fit is then extended to later years. A calibration factor
        accounts for mechanisms the model leaves out, such as electrode cracking.
      </p>
      <h2>Limitations</h2>
      <ul>
        <li>The parameters come from one NMC811 cylindrical cell (OKane2022). LFP packs usually age differently.</li>
        <li>Manufacturer buffers and battery-management software are not modelled.</li>
        <li>This is an educational estimate, not a diagnosis of a specific vehicle.</li>
      </ul>
    </article>
  );
}