import React from 'react';
import styles from './JerkyValidationPage.module.css';

// Component: JerkyValidationPage
// Note: Consider loading a clean sans font (e.g. Poppins or Inter) in your app layout for best results.
export default function JerkyValidationPage() {
  const timelineSteps = [
    {
      title: 'Pre-heat the dehydrator',
      text:
        'Start empty, bring air temperature to at least 65°C (target ~72°C), and record pre-heat time/temperature.',
    },
    {
      title: 'Record raw batch weight (W₀)',
      text: 'Weigh the total marinated beef before loading; record W₀ (kg) on the drying record.',
    },
    {
      title: 'Load the trays',
      text: 'Load evenly once ≥65°C is reached; record the loading time.',
    },
    {
      title: 'Drying & internal temps',
      text:
        'Around 10–12 hours, probe the thickest pieces at two points (top/bottom rack). Critical limit: each ≥72°C. Continue drying if not met.',
    },
    {
      title: 'Weight-loss endpoint',
      text:
        'After internal temp hits ≥72°C, keep drying until ≥54% weight loss. Record final weight Wf and % loss.',
    },
    {
      title: 'Release or corrective action',
      text:
        'Accept if temp ≥72°C at both points and weight loss ≥54%. Otherwise extend drying, retest, or hold for aw testing.',
    },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>
            Validated Jerky Drying Process: Time, Temperature, Weight Loss & Water Activity
          </h1>
          <p className={styles.heroSubtitle}>
            How we link drying temperature, time, and percentage weight reduction to consistently achieve water
            activity below 0.85 as part of our HACCP validation and verification program.
          </p>
          <div className={styles.chips}>
            <span className={styles.chip}>Validated method</span>
            <span className={styles.chip}>External lab proof</span>
            <span className={styles.chip}>HACCP verification</span>
          </div>

          <div className={styles.gridTwo}>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Objective</h3>
              <p className={styles.cardBody}>
                Demonstrate that our jerky drying process is controlled and repeatable. When we meet the critical
                limits for temperature, time, and weight loss, the product consistently finishes with aw &lt; 0.85,
                backed by external laboratory testing. This forms part of our HACCP validation and verification.
              </p>
            </div>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Key Parameters</h3>
              <div className={styles.keyParams}>
                <div className={styles.param}>
                  ≥ 72°C
                  <span>Internal temperature</span>
                </div>
                <div className={styles.param}>
                  ≥ 65°C
                  <span>Dehydrator air</span>
                </div>
                <div className={styles.param}>
                  ≥ 54%
                  <span>Weight loss</span>
                </div>
                <div className={styles.param}>
                  &lt; 0.85 aw
                  <span>Specification</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Basis of the Proof</h3>
            <div className={styles.cardBody}>
              <p>
                A representative beef jerky batch was produced under normal conditions and tested by a NATA-accredited
                lab (e.g. Symbio). The product water activity was 0.793 at ~25°C, safely below the 0.85 limit. The
                process was:
              </p>
              <ul className={styles.list}>
                <li>Dehydrator pre-heated to at least 65°C, typically operating near 72°C.</li>
                <li>Trays loaded once the dehydrator reached ≥65°C.</li>
                <li>
                  Drying continued until internal product temperature hit 72°C in the thickest pieces at two probe
                  points.
                </li>
                <li>Internal temperatures typically reached around the 12-hour mark.</li>
                <li>Overall weight reduction was ~54% (final dried weight ≈ 46% of raw weight).</li>
              </ul>
              <div className={styles.callout}>
                <strong>Critical limits derived from the validation batch:</strong>
                <ul className={styles.list}>
                  <li>Lethality: Internal product temperature ≥72°C at the thickest point, verified at two locations.</li>
                  <li>Drying endpoint: Minimum 54% weight loss from raw to dried.</li>
                  <li>Specification: Product water activity &lt; 0.85.</li>
                </ul>
                When future batches hit these limits, we expect aw results similar to the validation batch.
              </div>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Routine Production Process</h3>
            <div className={styles.timeline}>
              {timelineSteps.map((step, idx) => (
                <div key={step.title} className={styles.step} data-step={idx + 1}>
                  <div className={styles.stepTitle}>{step.title}</div>
                  <p className={styles.stepText}>{step.text}</p>
                </div>
              ))}
            </div>
            <div className={styles.callout}>
              <strong>Corrective actions:</strong> If internal temp is &lt;72°C, extend drying and re-probe. If weight
              loss is &lt;54%, continue drying and re-weigh until target is reached. If limits cannot be met or doubt
              remains, place the batch on hold, consider aw testing, and record corrective actions.
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Ongoing Verification Plan</h3>
            <div className={styles.cardBody}>
              <p>
                After validation, we turn the process into a standing proof system that is checked over time.
              </p>
              <ul className={styles.list}>
                <li>
                  <strong>Initial confirmation:</strong> For early batches (e.g. 10–20 per recipe/thickness), send
                  frequent aw samples. Confirm that batches meeting: dehydrator ≥65°C with internal temp ≥72°C, and
                  weight loss ≥54%, also deliver aw &lt; 0.85.
                </li>
                <li>
                  <strong>Routine verification:</strong> Once stable, test roughly 1 in 10 batches for aw, and always
                  test after process changes (new recipe, different cut thickness, different dehydrator, or altered
                  loading pattern).
                </li>
                <li>
                  <strong>Handling failures:</strong> If any verification result is ≥0.85, immediately hold that batch,
                  review recent batches since the last passing result, look for borderline temperature/weight-loss
                  data, adjust the process (longer drying or higher target loss), and re-validate with more frequent aw
                  testing before returning to 1-in-10 testing.
                </li>
                <li>
                  <strong>Documentation:</strong> The proof is the paper trail—drying records (time, temperatures,
                  weights, % loss), linked aw lab reports, and corrective action records.
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.auditorBox}>
            <div className={styles.auditorTitle}>Auditor Explanation</div>
            <p className={styles.auditorText}>
              Our beef jerky drying process is validated using in-process controls and external water activity testing.
              A representative validation batch achieved ~54% weight loss and a lab-confirmed water activity of 0.793,
              comfortably below the 0.85 safety threshold. We now control every batch by pre-heating the dehydrator to
              at least 65°C, drying until internal product temperature reaches 72°C at two points in the thickest
              pieces, and continuing until at least 54% weight loss from the raw beef weight is achieved. These
              parameters are recorded for each batch. To verify that this consistently results in water activity &lt;
              0.85, we submit at least every tenth batch—and all validation batches—for independent water activity
              testing. If any verification result is ≥0.85, affected product is held, the process is adjusted, and
              additional testing is completed before returning to routine verification.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
