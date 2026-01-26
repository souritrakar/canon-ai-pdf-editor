import { Composition } from "remotion";
import { CanonProductDemoComposition } from "../components/remotion/CanonProductDemo";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="CanonProductDemo"
        component={CanonProductDemoComposition}
        durationInFrames={645}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{}}
      />
    </>
  );
};
