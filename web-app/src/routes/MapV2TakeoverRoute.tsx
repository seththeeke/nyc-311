import { type ReactElement, useState } from "react";
import { useFeatureTreatment } from "../hooks/useFeatureTreatment";
import { MAP_V2_FLAG, MAP_V2_TAKEOVER } from "../models/featureTreatment";
import { isWebGlAvailable } from "../components/three/webgl";

interface MapV2TakeoverRouteProps {
  classic: ReactElement;
  takeover: ReactElement;
}

/**
 * The classic-map routes (`/`, `/about`) under MAP_V2 = T2: the 3-D map
 * takes over. The classic map renders while the flag loads (so C and T1
 * never wait on it) and whenever WebGL2 is missing — Mapv2 can't run
 * there, and its fallback links back to the classic map.
 */
export function MapV2TakeoverRoute({ classic, takeover }: MapV2TakeoverRouteProps): ReactElement {
  const { treatment } = useFeatureTreatment(MAP_V2_FLAG);
  const [webGl] = useState(isWebGlAvailable);
  return treatment === MAP_V2_TAKEOVER && webGl ? takeover : classic;
}
