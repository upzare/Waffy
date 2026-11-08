import { LOGO_URL } from "@/config";

const POINTS = [
  {
    number: "01",
    title: "Privacy-first",
    body: "Keys, settings, and chat history stay in this browser. Waffy does not run an inference backend and does not see your prompts.",
  },
  {
    number: "02",
    title: "Built-in and local models",
    body: "Use the browser’s own model - Gemini Nano in Chrome, Phi Mini in Edge, and Browser AI in other supported browsers or a local OpenAI-compatible server.",
  },
  {
    number: "03",
    title: "Automation, on this machine",
    body: "Waffy plans, clicks, types, and checks the result inside the extension. If you choose a cloud model, your prompt is sent only there.",
  },
] as const;

const FeatureStory = () => {
  return (
    <div className="relative min-h-full bg-[#070807] px-5 py-8 sm:px-8 lg:px-10 lg:py-8 xl:px-14">
      <div className="setup-noise pointer-events-none absolute inset-0 opacity-[0.14]" />
      <div className="pointer-events-none absolute -left-24 top-0 h-[28rem] w-[28rem] rounded-full bg-[#00ff00]/15 blur-[120px]" />
      <div className="relative">
        <div>
          <img src={LOGO_URL} alt="Waffy" className="h-10" />

          <p className="mt-6 font-mono text-xs font-medium uppercase tracking-[0.28em] text-[#00ff00]">
            Autonomous Browser Agent
          </p>

          <h1 className="mt-3 text-6xl font-bold leading-[0.88] tracking-[-0.06em]">
            RUNS ON YOUR
            <br />
            <span className="bg-linear-to-tr from-[#00ff00] to-white bg-clip-text text-transparent">
              MACHINE.
            </span>
          </h1>

          <p className="mt-3 max-w-md text-base leading-snug text-white/55">
            Your keys, chats, and browser session stay with you.
          </p>
        </div>

        <ol>
          {POINTS.map((point) => (
            <li key={point.number} className="border-l border-white/10 pl-5">
              <p className="mt-5 font-mono text-xs font-bold tracking-[0.22em] text-[#00ff00]/80">
                {point.number}
              </p>
              <h2 className="mt-1 text-lg font-bold tracking-[-0.03em]">{point.title}</h2>
              <p className="mt-0.5 max-w-md text-base leading-snug text-white/45">{point.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
};

export default FeatureStory;
