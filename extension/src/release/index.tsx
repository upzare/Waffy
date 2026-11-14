import { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { EXTENSION_VERSION } from "@/config";
import { Quote } from "lucide-react";
import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
import "@fontsource/space-grotesk/latin-400.css";
import "@fontsource/space-grotesk/latin-500.css";
import "@fontsource/space-grotesk/latin-700.css";
import "@fontsource/jetbrains-mono/latin-500.css";
import "@/stylesheets/globals.css";
import "@/setup/setup.css";
import "./release.css";
import { FOUNDER_URL, GITHUB_URL, LOGO_URL, X_VERSION_URL, WEBSTORE_URL } from "@/config";

const streamdownPlugins = { code };
const streamdownControls = {
  code: { copy: true, download: false },
  table: false,
  mermaid: false,
} as const;

const fetchReleaseNotes = async (version: string) => {
  const url = new URL(X_VERSION_URL);
  url.searchParams.set("version", version);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Release notes request failed (${response.status})`);
  }
  const result = await response.json();
  return result.notes;
}

const Release = () => {
  const [notes, setNotes] = useState<string | null>(null);

  useEffect(() => {
    fetchReleaseNotes(EXTENSION_VERSION)
      .then((content) => setNotes(content))
      .catch(() => setNotes("Release notes not found"));
  }, [EXTENSION_VERSION]);

  return (
    <div className="setup-root overflow-x-hidden">
      <div className="mx-auto grid min-h-dvh max-w-[1500px] lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)]">
        <aside className="relative min-w-0 overflow-hidden border-white/10 bg-[#070807] px-6 py-8 sm:px-10 lg:border-r lg:px-12">
          <div className="setup-noise pointer-events-none absolute inset-0 opacity-15" />
          <div className="pointer-events-none absolute -left-24 top-0 size-96 rounded-full bg-[#00ff00]/10 blur-3xl" />
          <div className="relative">
            <img src={LOGO_URL} alt="Waffy" className="h-10" />
            <p className="mt-10 font-mono text-xs font-medium uppercase tracking-widest text-[#00ff00]">
              {EXTENSION_VERSION ? `Version ${EXTENSION_VERSION}` : "Release"}
            </p>
            <h1 className="mt-7 text-6xl font-bold leading-none tracking-tight">
              Waffy just
              <br />
              got{" "}
              <span className="bg-linear-to-tr from-[#00ff00] to-white bg-clip-text text-transparent">
                updated.
              </span>
            </h1>
            <figure className="mt-14">
              <Quote size={28} className="text-[#00ff00] rotate-180" aria-hidden="true" />
              <blockquote className="mt-3 text-xl leading-relaxed text-white/70 italic">
                I've been trying to ship as many features as I can. Getting each one right takes
                longer than it looks. If Waffy is useful to you, kindly star the repo on{" "}
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-3"
                >
                  GitHub
                </a>{" "}
                and leave a review on the{" "}
                <a
                  href={WEBSTORE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-3"
                >
                  Web Store
                </a>
                .
              </blockquote>
              <Quote size={28} className="mt-3 ml-auto text-[#00ff00]" aria-hidden="true" />
              <figcaption className="mt-2 text-right">
                <span className="block text-base font-bold text-white">
                  <a href={FOUNDER_URL} target="_blank" rel="noreferrer">
                    Aravind Manoj
                  </a>
                </span>
                <span className="mt-0.5 block text-base text-white/45">Founder</span>
              </figcaption>
            </figure>
          </div>
        </aside>

        <section className="min-w-0 bg-black px-6 py-8 sm:px-10 lg:px-12">
          <h2 className="text-5xl font-bold leading-tight tracking-tight text-[#00ff00]">
            What's new
          </h2>
          <div className="my-4 h-0.5 w-full bg-white/10" />
          {notes === null ? (
            <p className="text-base text-white/50">Loading release notes…</p>
          ) : (
            <Streamdown
              className="release-notes"
              plugins={streamdownPlugins}
              mode="static"
              isAnimating={false}
              shikiTheme={["github-dark", "github-dark"]}
              lineNumbers={false}
              controls={streamdownControls}
              linkSafety={{ enabled: false }}
            >
              {notes}
            </Streamdown>
          )}
        </section>
      </div>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById("root")!).render(<Release />);
