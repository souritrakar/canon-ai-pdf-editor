"use client";

import { Player } from "@remotion/player";
import { CanonDemoComposition } from "./CanonDemo";

interface CanonDemoPlayerProps {
  className?: string;
}

export const CanonDemoPlayer: React.FC<CanonDemoPlayerProps> = ({
  className,
}) => {
  return (
    <div className={className}>
      <Player
        component={CanonDemoComposition}
        durationInFrames={540} // 18 seconds at 30fps (6 seconds per demo step x 3 steps)
        fps={30}
        compositionWidth={800}
        compositionHeight={600}
        loop
        autoPlay
        acknowledgeRemotionLicense
        style={{
          width: "100%",
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 25px 50px rgba(28, 25, 23, 0.12)",
        }}
      />
    </div>
  );
};

export default CanonDemoPlayer;
