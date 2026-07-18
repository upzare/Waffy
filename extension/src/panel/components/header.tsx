import Browser from "webextension-polyfill";
import { Plus, Settings } from "lucide-react";
import type { HeaderProps } from "../../types";

const Header: React.FC<HeaderProps> = ({ currentConversationId, currentTitle, onNewChat }) => {
  const openSettings = () => {
    void Browser.runtime.openOptionsPage();
  };

  return (
    <header className="flex items-center justify-between px-6 py-4 bg-[rgba(10,10,10,0.7)] backdrop-blur-[3px] border-b border-border z-10 gap-4">
      <div className="flex-1">
        {!!!currentConversationId ? (
          <img src="/assets/logo.svg" alt="Waffy Logo" className="h-6 w-auto brightness-[1.2]" />
        ) : (
          <button
            className="flex items-center justify-center bg-[rgba(255,255,255,0.1)] border border-[rgba(255,255,255,0.2)] text-white w-9 h-9 rounded-md cursor-pointer transition-[background] duration-200 ease-in-out hover:bg-[rgba(255,255,255,0.15)]"
            onClick={onNewChat}
            title="New Chat"
          >
            <Plus className="w-5 h-5 stroke-white" />
          </button>
        )}
      </div>

      {!!currentConversationId && (
        <div className="flex overflow-hidden">
          <div
            className="text-base font-medium text-white text-center text-ellipsis whitespace-nowrap overflow-hidden"
            title={currentTitle}
          >
            {currentTitle}
          </div>
        </div>
      )}

      <div className="flex-1 flex justify-end">
        <button
          className="flex items-center justify-center bg-[rgba(255,255,255,0.1)] border border-[rgba(255,255,255,0.2)] text-white w-9 h-9 rounded-md cursor-pointer transition-[background] duration-200 ease-in-out hover:bg-[rgba(255,255,255,0.15)]"
          title="Settings"
          onClick={openSettings}
        >
          <Settings className="w-5 h-5 stroke-white" />
        </button>
      </div>
    </header>
  );
};

export default Header;
