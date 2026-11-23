import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 뽑기 시뮬레이터는 주소의 ?lane=·?banner=에 따라 화면이 달라진다.
  // 서버가 쿼리를 읽으면 매번 새로 그려야 해서, 경로로 바꿔 보내 주소별로 캐시되게 한다
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/simulator",
          has: [
            { type: "query", key: "lane", value: "(?<lane>train|support)" },
            { type: "query", key: "banner", value: "(?<banner>[0-9]+)" },
          ],
          destination: "/simulator/:lane/:banner",
        },
        {
          source: "/simulator",
          has: [{ type: "query", key: "lane", value: "(?<lane>train|support)" }],
          destination: "/simulator/:lane/latest",
        },
        {
          source: "/simulator",
          has: [{ type: "query", key: "banner", value: "(?<banner>[0-9]+)" }],
          destination: "/simulator/train/:banner",
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
