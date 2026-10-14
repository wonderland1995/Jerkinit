import { computeBestBefore, formatDate } from './utils';
import { resolveBatchDisplayId, type BatchDetails, type BatchStatus, type MaterialTraceRow, type ActualRow, type QaSummaryResp, type QaStage, type QaCheckpointReport, type BeefAllocationReport, type CoreTempReadingMeta, type MarinationTimesMeta, type TraceResp, type ActualsResp } from './batchReportTypes';

const prettyStage = (stage: QaStage) => stage.charAt(0).toUpperCase() + stage.slice(1);

export async function createBatchPdf({ batch, materials, actuals, scale, qaSummary, beefTotalG = 0 }: {
  batch: BatchDetails;
  materials: MaterialTraceRow[];
  actuals: Record<string, ActualRow>;
  scale: number;
  qaSummary: QaSummaryResp | null;
  beefTotalG?: number;
}) {
  const batchId = batch.id;
      const jsPDFModule = await import('jspdf');
      const autoTableModule = await import('jspdf-autotable');

      const { jsPDF } = jsPDFModule;
      const autoTableFn = autoTableModule.default;

      if (typeof autoTableFn !== 'function') {
        throw new Error('PDF export module failed to load');
      }

      const [qaRes, beefRes] = await Promise.all([
        fetch(`/api/batches/${batchId}/qa`),
        fetch(`/api/batches/${batchId}/beef`),
      ]);

      if (!qaRes.ok) {
        throw new Error('Unable to load QA data for export.');
      }

      if (!beefRes.ok) {
        throw new Error('Unable to load beef allocation data for export.');
      }

      const qaJson = (await qaRes.json()) as { checkpoints?: QaCheckpointReport[] };
      const beefJson = (await beefRes.json()) as {
        allocations?: BeefAllocationReport[];
        total_g?: number;
      };

      const qaCheckpoints = Array.isArray(qaJson.checkpoints) ? qaJson.checkpoints : [];
      const beefAllocations = Array.isArray(beefJson.allocations) ? beefJson.allocations : [];
      const recordedBeefTotal =
        typeof beefJson.total_g === 'number' ? beefJson.total_g : beefTotalG;
      const formatStatus = (value: BatchStatus) =>
        value
          .split('_')
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' ');

      const formatDateTime = (value: string | null | undefined) => {
        if (!value) return '-';
        const dt = new Date(value);
        return Number.isNaN(dt.getTime()) ? '-' : dt.toLocaleString();
      };

      const parseNumeric = (value: unknown): number | null => {
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        if (typeof value === 'string') {
          const parsed = Number(value);
          return Number.isFinite(parsed) ? parsed : null;
        }
        return null;
      };

      const weightSnapshot = qaCheckpoints.reduce<{
        wetKg: number | null;
        dryKg: number | null;
        lossPercent: number | null;
        checkpointLabel: string | null;
        checkedAt: string | null;
        score: number;
        ts: number;
      }>(
        (best, checkpoint) => {
          const metadata =
            checkpoint.metadata && typeof checkpoint.metadata === 'object'
              ? (checkpoint.metadata as Record<string, unknown>)
              : null;
          const rawWeightLog =
            metadata && typeof metadata['weight_log'] === 'object'
              ? (metadata['weight_log'] as Record<string, unknown>)
              : null;
          if (!rawWeightLog) return best;

          const wet = parseNumeric(rawWeightLog['wet_weight_kg']);
          const dry = parseNumeric(rawWeightLog['dry_weight_kg']);
          const lossRaw = parseNumeric(rawWeightLog['weight_loss_percent']);
          const loss =
            lossRaw != null
              ? lossRaw
              : wet != null && dry != null && wet > 0
              ? ((wet - dry) / wet) * 100
              : null;
          const score =
            (wet != null ? 1 : 0) + (dry != null ? 2 : 0) + (loss != null ? 4 : 0);
          if (score === 0) return best;

          const ts =
            checkpoint.last_checked_at && Number.isFinite(Date.parse(checkpoint.last_checked_at))
              ? Date.parse(checkpoint.last_checked_at)
              : Number.NEGATIVE_INFINITY;

          if (score > best.score || (score === best.score && ts > best.ts)) {
            const checkpointLabel = [checkpoint.code, checkpoint.name]
              .filter(Boolean)
              .join(' - ');
            return {
              wetKg: wet,
              dryKg: dry,
              lossPercent: loss,
              checkpointLabel: checkpointLabel || checkpoint.code || checkpoint.name || null,
              checkedAt: checkpoint.last_checked_at,
              score,
              ts,
            };
          }
          return best;
        },
        {
          wetKg: null,
          dryKg: null,
          lossPercent: null,
          checkpointLabel: null,
          checkedAt: null,
          score: -1,
          ts: Number.NEGATIVE_INFINITY,
        },
      );

      const beefQaByLot: Array<{
        lot_number: string;
        internal_code: string;
        temp: string;
        packaging: string;
        odour: string;
        visual: string;
        result: string;
        checkedAt: string;
      }> = [];
      const seenLots = new Set<string>();
      for (const alloc of beefAllocations) {
        const lot = Array.isArray(alloc.lot) ? alloc.lot[0] : alloc.lot;
        if (!lot || !lot.id || seenLots.has(lot.id)) continue;
        seenLots.add(lot.id);
        const coa =
          lot.certificate_of_analysis && typeof lot.certificate_of_analysis === 'object'
            ? (lot.certificate_of_analysis as Record<string, unknown>)
            : {};
        const temp = typeof coa['receiving_temp_c'] === 'number' ? `${coa['receiving_temp_c']} °C` : '-';
        const packaging = coa['packaging_intact'] === false ? 'Fail' : coa['packaging_intact'] === true ? 'OK' : '-';
        const odour = coa['odour_ok'] === false ? 'Fail' : coa['odour_ok'] === true ? 'OK' : '-';
        const visual = coa['visual_ok'] === false ? 'Fail' : coa['visual_ok'] === true ? 'OK' : '-';
        const result = lot.passed_receiving_qa === false ? 'Fail' : lot.passed_receiving_qa === true ? 'Pass' : '-';
        const checkedAt =
          typeof coa['check_time'] === 'string' ? formatDateTime(coa['check_time']) : '';
        beefQaByLot.push({
          lot_number: lot.lot_number,
          internal_code: lot.internal_lot_code,
          temp,
          packaging,
          odour,
          visual,
          result,
          checkedAt,
        });
      }

      const formatTemperatures = (checkpoint: QaCheckpointReport) => {
        const parts: string[] = [];
        if (checkpoint.temperature_c != null) {
          parts.push(`${Number(checkpoint.temperature_c).toFixed(1)} deg C`);
        }

        const meta = checkpoint.metadata ?? null;
        if (meta && typeof meta === 'object') {
          const metaRecord = meta as Record<string, unknown>;

          if ('tempC' in metaRecord && typeof metaRecord.tempC === 'number') {
            parts.push(`${Number(metaRecord.tempC).toFixed(1)} deg C`);
          }

          if ('readings' in metaRecord && Array.isArray(metaRecord.readings)) {
            const readings = metaRecord.readings as CoreTempReadingMeta[];
            readings.forEach((reading, idx) => {
              const tempValue =
                typeof reading?.tempC === 'number' ? reading.tempC : null;
              const holdValue =
                typeof reading?.minutes === 'number' ? reading.minutes : null;
              if (tempValue != null || holdValue != null) {
                const labels: string[] = [];
                if (tempValue != null) {
                  labels.push(`${tempValue.toFixed(1)} deg C`);
                }
                if (holdValue != null) {
                  labels.push(`${holdValue.toFixed(0)} min`);
                }
                if (labels.length > 0) {
                  parts.push(`Probe ${idx + 1}: ${labels.join(' / ')}`);
                }
              }
            });
          }

          const marMeta = metaRecord as MarinationTimesMeta;
          if (typeof marMeta?.tempC === 'number') {
            parts.push(`${marMeta.tempC.toFixed(1)} deg C`);
          }
        }

        return parts.length ? parts.join('; ') : '—';
      };

        const formatOtherMeasurements = (checkpoint: QaCheckpointReport) => {
          const metrics: string[] = [];
          if (checkpoint.humidity_percent != null) {
            metrics.push(`Humidity ${Number(checkpoint.humidity_percent).toFixed(1)} %`);
          }
          if (checkpoint.water_activity != null) {
            metrics.push(`aw ${Number(checkpoint.water_activity).toFixed(3)}`);
          }
          if (checkpoint.ph_level != null) {
            metrics.push(`pH ${Number(checkpoint.ph_level).toFixed(2)}`);
          }

          const meta = checkpoint.metadata ?? null;
          if (meta && typeof meta === 'object') {
            const metaRecord = meta as Record<string, unknown>;
            if ('aw' in metaRecord && typeof metaRecord.aw === 'number') {
              metrics.push(`aw ${Number(metaRecord.aw).toFixed(3)}`);
            }
            if ('weight_log' in metaRecord && typeof metaRecord.weight_log === 'object') {
              const wl = metaRecord.weight_log as Record<string, unknown>;
              const wet =
                typeof wl.wet_weight_kg === 'number'
                  ? wl.wet_weight_kg
                  : typeof wl.wet_weight_kg === 'string'
                  ? Number(wl.wet_weight_kg)
                  : null;
              const dry =
                typeof wl.dry_weight_kg === 'number'
                  ? wl.dry_weight_kg
                  : typeof wl.dry_weight_kg === 'string'
                  ? Number(wl.dry_weight_kg)
                  : null;
              const loss =
                typeof wl.weight_loss_percent === 'number'
                  ? wl.weight_loss_percent
                  : typeof wl.weight_loss_percent === 'string'
                  ? Number(wl.weight_loss_percent)
                  : wet && dry && wet > 0
                  ? ((wet - dry) / wet) * 100
                  : null;
              const weightPieces = [
                wet != null && Number.isFinite(wet) ? `wet ${wet.toFixed(2)} kg` : null,
                dry != null && Number.isFinite(dry) ? `dry ${dry.toFixed(2)} kg` : null,
                loss != null && Number.isFinite(loss) ? `water loss ${loss.toFixed(1)}%` : null,
              ].filter(Boolean);
              if (weightPieces.length > 0) {
                metrics.push(`Weight ${weightPieces.join(', ')}`);
              }
            }

            const marMeta = metaRecord as MarinationTimesMeta;
            const startLabelRaw = marMeta.startISO ? formatDateTime(marMeta.startISO) : '';
          const endLabelRaw = marMeta.endISO ? formatDateTime(marMeta.endISO) : '';
          const startLabel = startLabelRaw === '-' ? '' : startLabelRaw;
          const endLabel = endLabelRaw === '-' ? '' : endLabelRaw;
          if (startLabel || endLabel) {
            const windowLabel = [startLabel, endLabel].filter(Boolean).join(' -> ');
            if (windowLabel) {
              metrics.push(`Marination ${windowLabel}`);
            }
          }

          const dryingRun = metaRecord['drying_run'];
          if (dryingRun && typeof dryingRun === 'object') {
            const ovenValue =
              typeof dryingRun['oven_temp_c'] === 'number'
                ? dryingRun['oven_temp_c']
                : typeof dryingRun['oven_temp_c'] === 'string'
                ? Number(dryingRun['oven_temp_c'])
                : null;
            if (Number.isFinite(ovenValue)) {
              metrics.push(`Oven ${Number(ovenValue).toFixed(1)} deg C`);
            }
            const startIso =
              typeof dryingRun['start_iso'] === 'string'
                ? (dryingRun['start_iso'] as string)
                : typeof dryingRun['startISO'] === 'string'
                ? (dryingRun['startISO'] as string)
                : null;
            const endIso =
              typeof dryingRun['end_iso'] === 'string'
                ? (dryingRun['end_iso'] as string)
                : typeof dryingRun['endISO'] === 'string'
                ? (dryingRun['endISO'] as string)
                : null;
            const startLabel = startIso ? formatDateTime(startIso) : '';
            const endLabel = endIso ? formatDateTime(endIso) : '';
            if (startLabel || endLabel) {
              const label = [startLabel, endLabel].filter(Boolean).join(' -> ');
              if (label) {
                metrics.push(`Drying ${label}`);
              }
            }
            if (startIso && endIso) {
              const startTs = Date.parse(startIso);
              const endTs = Date.parse(endIso);
              if (Number.isFinite(startTs) && Number.isFinite(endTs) && endTs > startTs) {
                const minutes = Math.round((endTs - startTs) / 60000);
                const hours = Math.floor(minutes / 60);
                const mins = minutes % 60;
                const durationLabel = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
                metrics.push(`Duration ${durationLabel}`);
              }
            }
          }
        }

        return metrics.length ? metrics.join('; ') : '-';
      };

      const toQaRow = (checkpoint: QaCheckpointReport) => {
        const checkpointLabel = [checkpoint.code, checkpoint.name]
          .filter(Boolean)
          .join(' - ');
        return [
          checkpointLabel || 'Checkpoint',
          prettyStage(checkpoint.stage),
          checkpoint.status ? checkpoint.status.toUpperCase() : 'PENDING',
          formatTemperatures(checkpoint),
          formatOtherMeasurements(checkpoint),
          formatDateTime(checkpoint.last_checked_at),
        ];
      };

      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const marginLeft = 14;
      let cursorY = 18;

      const batchLabel = resolveBatchDisplayId(batch);
      const bestBeforeDate =
        batch.best_before_date && new Date(batch.best_before_date)
          ? new Date(batch.best_before_date)
          : computeBestBefore(batch.production_date ?? batch.created_at ?? null);
      const bestBeforeText =
        bestBeforeDate && !Number.isNaN(bestBeforeDate.getTime())
          ? formatDate(bestBeforeDate)
          : 'Not set';
      doc.setFontSize(16);
      doc.text(`Batch ${batchLabel}`, marginLeft, cursorY);
      cursorY += 6;

      doc.setFontSize(10);
      const summaryLines = [
        `Recipe: ${batch.recipe?.name ?? 'N/A'}${
          batch.recipe?.recipe_code ? ` (${batch.recipe.recipe_code})` : ''
        }`,
        `Production Date: ${formatDateTime(batch.production_date).split(',')[0]}`,
        `Best Before: ${bestBeforeText}`,
        `Status: ${formatStatus(batch.status)}`,
        `Scale: ${scale.toFixed(2)} x`,
        `Beef Input: ${Number(batch.beef_weight_kg).toFixed(2)} kg`,
        `Beef Recorded: ${Number(recordedBeefTotal).toFixed(0)} g`,
      ];

      if (qaSummary) {
        summaryLines.push(
          `QA Progress: ${prettyStage(qaSummary.current_stage)} at ${qaSummary.percent_complete.toFixed(0)}%`,
        );
      }

      summaryLines.forEach((line) => {
        doc.text(line, marginLeft, cursorY);
        cursorY += 5;
      });

      cursorY += 2;

      const pageWidth = doc.internal.pageSize.getWidth();
      const boxWidth = pageWidth - marginLeft * 2;
      const boxHeight = 24;
      const lossLabel =
        weightSnapshot.lossPercent != null && Number.isFinite(weightSnapshot.lossPercent)
          ? `${weightSnapshot.lossPercent.toFixed(1)}% Weight Loss`
          : 'Weight Loss Not Recorded';
      const wetLabel =
        weightSnapshot.wetKg != null && Number.isFinite(weightSnapshot.wetKg)
          ? `${weightSnapshot.wetKg.toFixed(2)} kg`
          : 'Not recorded';
      const dryLabel =
        weightSnapshot.dryKg != null && Number.isFinite(weightSnapshot.dryKg)
          ? `${weightSnapshot.dryKg.toFixed(2)} kg`
          : 'Not recorded';
      const sourceParts = [
        weightSnapshot.checkpointLabel,
        weightSnapshot.checkedAt ? formatDateTime(weightSnapshot.checkedAt) : null,
      ].filter(Boolean);

      doc.setDrawColor(30, 64, 175);
      doc.setFillColor(239, 246, 255);
      doc.roundedRect(marginLeft, cursorY, boxWidth, boxHeight, 2, 2, 'FD');
      doc.setTextColor(30, 64, 175);
      doc.setFontSize(10);
      doc.text('Weight Loss Summary', marginLeft + 3, cursorY + 5);
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(16);
      doc.text(lossLabel, marginLeft + 3, cursorY + 12);
      doc.setFontSize(10);
      doc.text(`Start (wet): ${wetLabel}`, marginLeft + 3, cursorY + 18);
      doc.text(`Finish (dry): ${dryLabel}`, marginLeft + boxWidth / 2, cursorY + 18);
      if (sourceParts.length > 0) {
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text(`Source: ${sourceParts.join(' @ ')}`, marginLeft + 3, cursorY + 22);
      }

      cursorY += boxHeight + 6;
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.text('Ingredients', marginLeft, cursorY);
      cursorY += 2;

      const ingredientRows = materials.map((material) => {
        const actualRow = actuals[material.material_id];
        const actualAmount = actualRow?.actual_amount ?? null;
        const tolerance = actualRow?.tolerance_percentage ?? material.tolerance_percentage;
        const actualUnit = actualRow?.unit ?? material.unit;

        const actualLabel =
          actualAmount == null
            ? '—'
            : `${Number(actualAmount).toFixed(2)} ${actualUnit}`;
        const statusLabel =
          actualRow?.in_tolerance === true
            ? 'OK'
            : actualRow?.in_tolerance === false
            ? 'Out'
            : actualAmount != null
            ? 'Pending'
            : 'Not recorded';

        return [
          material.material_name,
          `${Number(material.target_amount).toFixed(2)} ${material.unit}`,
          actualLabel,
          `${Number(tolerance).toFixed(1)} %`,
          material.is_critical ? 'Yes' : 'No',
          statusLabel,
        ];
      });

      autoTableFn(doc, {
        startY: cursorY + 4,
        head: [['Ingredient', 'Target', 'Actual', 'Tolerance', 'Critical', 'Status']],
        body: ingredientRows,
        styles: { fontSize: 9, cellPadding: 2.5 },
        headStyles: { fillColor: [30, 41, 59], textColor: 255 },
      });

      const getLastTableBottom = () => {
        const lastTable = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
        return lastTable?.finalY ?? cursorY;
      };

      cursorY = getLastTableBottom() + 8;

      doc.setFontSize(12);
      doc.text('QA Measurements', marginLeft, cursorY);
      cursorY += 4;

      const qaRows = qaCheckpoints.map(toQaRow);

      if (qaRows.length > 0) {
        autoTableFn(doc, {
          startY: cursorY,
          head: [['Checkpoint', 'Stage', 'Status', 'Temperatures', 'Other Readings', 'Checked At']],
          body: qaRows,
          styles: { fontSize: 9, cellPadding: 2 },
          headStyles: { fillColor: [30, 64, 175], textColor: 255 },
        });
        cursorY = getLastTableBottom() + 8;
      } else {
        doc.setFontSize(10);
        doc.text('No QA measurements recorded.', marginLeft, cursorY);
        cursorY += 8;
      }

      doc.setFontSize(12);
      doc.text('Beef Allocations', marginLeft, cursorY);
      cursorY += 4;

      if (beefAllocations.length > 0) {
        const beefRows = beefAllocations.map((allocation) => {
          const lot = allocation.lot ?? null;
          const supplier =
            lot?.supplier && typeof lot.supplier === 'object'
              ? (lot.supplier as { name?: string | null }).name ?? null
              : null;
          return [
            lot?.lot_number ?? '—',
            lot?.internal_lot_code ?? '—',
            `${Number(allocation.quantity_used ?? 0).toFixed(0)} g`,
            supplier ?? '—',
            formatDateTime(allocation.allocated_at),
          ];
        });

        autoTableFn(doc, {
          startY: cursorY,
          head: [['Lot Number', 'Internal Code', 'Quantity', 'Supplier', 'Allocated At']],
          body: beefRows,
          styles: { fontSize: 9, cellPadding: 2 },
          headStyles: { fillColor: [22, 101, 52], textColor: 255 },
        });
        cursorY = getLastTableBottom() + 8;
      } else {
        doc.setFontSize(10);
        doc.text('No beef allocations recorded.', marginLeft, cursorY);
        cursorY += 8;
      }

      doc.setFontSize(12);
      doc.text('Beef QA Checks', marginLeft, cursorY);
      cursorY += 4;

      if (beefQaByLot.length > 0) {
        const beefQaRows = beefQaByLot.map((row) => [
          row.lot_number ?? '-',
          row.internal_code ?? '-',
          row.temp,
          row.packaging,
          row.odour,
          row.visual,
          row.result,
          row.checkedAt || '-',
        ]);
        autoTableFn(doc, {
          startY: cursorY,
          head: [
            ['Lot #', 'Internal Code', 'Receiving Temp', 'Packaging', 'Odour', 'Visual', 'Result', 'Checked At'],
          ],
          body: beefQaRows,
          styles: { fontSize: 9, cellPadding: 2 },
          headStyles: { fillColor: [59, 7, 100], textColor: 255 },
        });
      } else {
        doc.setFontSize(10);
        doc.text('No beef receiving QA recorded from lots.', marginLeft, cursorY);
      }

      const filename = `${batchLabel.replace(/[^a-zA-Z0-9._-]/g, "_") || "batch"}-batch-report.pdf`;
      return { doc, filename };
}

export async function loadBatchPdf(batchId: string) {
  const paths = ['', '/traceability', '/ingredients/actuals', '/qa/progress'];
  const responses = await Promise.all(paths.map(path => fetch(`/api/batches/${encodeURIComponent(batchId)}${path}`, { cache: 'no-store' })));
  if (responses.some(response => !response.ok)) throw new Error('Unable to load complete batch data for export.');
  const [details, trace, ingredients, progress] = await Promise.all(responses.map(response => response.json())) as [
    { batch?: BatchDetails }, TraceResp, ActualsResp, QaSummaryResp
  ];
  if (!details.batch) throw new Error('Batch not found.');
  return createBatchPdf({
    batch: details.batch,
    materials: trace.materials ?? [],
    actuals: Object.fromEntries((ingredients.actuals ?? []).filter(row => row.material_id).map(row => [row.material_id!, row])),
    scale: trace.batch?.scale ?? 1,
    qaSummary: progress,
  });
}
