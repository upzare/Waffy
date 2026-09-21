import type { ReactNode } from "react";
import { Streamdown } from "streamdown";
import {
  MENTION_CHIP_BUBBLE_CLASS,
  parsePageSources,
  wrapPromptMentions,
} from "../utils/page-mentions";

const mentionComponents = {
  mention: ({ children }: { children?: ReactNode }) => (
    <span className={MENTION_CHIP_BUBBLE_CLASS}>{children}</span>
  ),
};

function TaggedPrompt({ prompt, pageSources }: { prompt: string; pageSources?: string }) {
  return (
    <Streamdown
      mode="static"
      className="wrap-break-word w-full"
      controls={false}
      lineNumbers={false}
      linkSafety={{ enabled: false }}
      allowedTags={{ mention: [] }}
      literalTagContent={["mention"]}
      components={mentionComponents}
    >
      {wrapPromptMentions(prompt, parsePageSources(pageSources))}
    </Streamdown>
  );
}

export default TaggedPrompt;
