import Estimator from "@/components/Estimator";

export default function Home() {
  return (
    <>
      <section className="hero">
        <h1>How long will your EV battery last?</h1>
        <p>
          A physics-based forecast of battery state of health for your vehicle, climate and charging
          habits — plus when the pack becomes a candidate for second-life grid storage.
        </p>
      </section>
      <Estimator />
    </>
  );
}