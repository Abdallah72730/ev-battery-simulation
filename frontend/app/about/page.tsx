import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How it works | EV Battery Health Estimator",
  description: "The electrochemical model, assumptions and limitations behind the battery health estimate.",
};

export default function About() {
  return (
    <article className="article">
      <h1 className="headline">How the estimate works</h1>
      <p className="lede">
        Each estimate runs an electrochemical battery model built with{" "}
        <a href="https://pybamm.org" target="_blank" rel="noopener noreferrer">PyBaMM</a>, an open-source battery
        modelling library. It simulates your first year of driving in full, then projects it forward.
      </p>

      <ol className="steps">
        <li>
          <h2>Your day becomes a test cycle</h2>
          <p>
            Daily distance, vehicle efficiency and charger power turn into one day of use: driving, parking,
            then charging back to your chosen level. Everything is scaled to pack size, so the same model works
            for a hatchback or a city bus.
          </p>
        </li>
        <li>
          <h2>A full year is simulated</h2>
          <p>
            The model runs 365 of those days, with the temperature changing month by month for your climate. If
            the battery is heated and cooled, it stays between 15 and 30 °C while driving and charging, but sits
            at the outside temperature while parked.
          </p>
        </li>
        <li>
          <h2>Two kinds of wear are tracked</h2>
          <p>
            A surface film (the SEI) slowly grows on the graphite electrode and traps lithium. It grows faster
            in heat and at a high state of charge. Fast or cold charging can also plate metallic lithium onto
            the electrode, and part of it is lost for good.
          </p>
        </li>
        <li>
          <h2>The trend is projected forward</h2>
          <p>
            The lithium lost in the first year is fitted with a square-root-of-time term, which is typical of
            film growth, plus a straight-line term for wear from each cycle. That fit is extended to later
            years and scaled by a calibration factor for wear the model leaves out, such as electrode cracking.
          </p>
        </li>
      </ol>

      <h3>Limitations</h3>
      <ul>
        <li>The parameters come from one NMC811 cylindrical cell (OKane2022). LFP batteries usually age differently.</li>
        <li>Manufacturer buffers and battery-management software aren&apos;t modelled.</li>
        <li>Absolute numbers are still being calibrated against real fleet data, so they lean optimistic.</li>
      </ul>
    </article>
  );
}
