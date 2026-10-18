import { type ReactElement, useCallback, useMemo, useState } from "react";
import { useMatch, useNavigate } from "react-router-dom";
import { useFleetLocations } from "../../hooks/useFleetLocations";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useTheme } from "../../hooks/useTheme";
import { CityHud } from "../mapv2/CityHud";
import { CityView } from "../mapv2/CityView";
import { DiveView } from "../mapv2/DiveView";
import { FleetRoster } from "../mapv2/FleetRoster";
import { MAP_V2_JOB_PATTERN, MAP_V2_PATH, mapV2JobPath } from "../mapv2/mapV2Routes";
import { OperatorCard } from "../mapv2/OperatorCard";
import { WebGlFallback } from "../mapv2/WebGlFallback";
import { isWebGlAvailable } from "../three/webgl";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function MapV2Workspace(): ReactElement {
  const { locations, isLoading, error } = useFleetLocations();
  const operators = useMemo(() => locations?.operators ?? [], [locations]);
  const { theme } = useTheme();
  const reducedMotion = useMediaQuery(REDUCED_MOTION);
  const navigate = useNavigate();
  const orderId = useMatch(MAP_V2_JOB_PATTERN)?.params.orderId ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [divingId, setDivingId] = useState<string | null>(null);

  const selected = operators.find((o) => o.operator_id === selectedId);
  const diveOperator = orderId === null ? undefined : operators.find((o) => o.current_order?.order_id === orderId);

  const onDiveArrived = useCallback(() => {
    const order = operators.find((o) => o.operator_id === divingId)?.current_order;
    setDivingId(null);
    if (order) navigate(mapV2JobPath(order.order_id));
  }, [operators, divingId, navigate]);

  const exitDive = useCallback(() => {
    if (diveOperator) setSelectedId(diveOperator.operator_id);
    navigate(MAP_V2_PATH);
  }, [diveOperator, navigate]);

  return (
    <main className="@container relative h-full w-full overflow-hidden bg-surface">
      <CityView
        operators={operators}
        theme={theme}
        selectedId={selectedId}
        onSelect={setSelectedId}
        divingId={divingId}
        onDiveArrived={onDiveArrived}
        paused={orderId !== null}
        reducedMotion={reducedMotion}
      />
      {orderId === null && (
        <>
          {/* One row, left to right: summary, roster, then the selected vehicle; it wraps when the workspace is narrow. Clear of the camera controls on the right. */}
          <div className="pointer-events-none absolute top-4 right-20 left-4 z-10 flex flex-wrap items-start gap-3">
            <CityHud operators={operators} isLoading={isLoading} error={error} yieldWhenNarrow={selected !== undefined} />
            <FleetRoster operators={operators} selectedId={selectedId} onSelect={setSelectedId} />
            {selected && (
              <OperatorCard
                key={selected.operator_id}
                operator={selected}
                diving={divingId !== null}
                onDive={() => setDivingId(selected.operator_id)}
                onClose={() => setSelectedId(null)}
              />
            )}
          </div>
        </>
      )}
      {orderId !== null && (
        <DiveView operator={diveOperator} isLoading={isLoading} theme={theme} reducedMotion={reducedMotion} onExit={exitDive} />
      )}
    </main>
  );
}

/**
 * Mapv2 — the 3-D city map prototype behind the MAP_V2 flag, alongside
 * (never replacing) the classic map. `/mapv2` is the live city;
 * `/mapv2/job/:orderId` dives into one crew's job over it.
 */
export function MapV2Page(): ReactElement {
  const [webGl] = useState(isWebGlAvailable);
  return webGl ? <MapV2Workspace /> : <WebGlFallback />;
}
