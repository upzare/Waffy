import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import Browser from 'webextension-polyfill';
import { Settings, Github } from 'lucide-react';
import { VERSION } from '../config';
import { StorageResult } from '../types';

const App = () => {
    const [isActive, setIsActive] = useState<boolean>(false);

    useEffect(() => {
        const fetchToggleState = async () => {
            const result = await Browser.storage.local.get("isActive") as StorageResult;
            await Browser.runtime.sendMessage({ type: "toggle", isActive: result.isActive });
            setIsActive(Boolean(result.isActive));
        };

        fetchToggleState();
    }, []);

    const handleToggle = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const newState = e.target.checked;
        setIsActive(newState);
        await Browser.storage.local.set({ isActive: newState });
        await Browser.runtime.sendMessage({ type: "toggle", isActive: newState });
    };

    return (
        <>
            <header className="headerSection">
                <div className="headerContent">
                    <div className="logoTitle">
                        <img src="logo.svg" alt="Logo" className="logo" />
                        <h1>Waffy</h1>
                    </div>
                    <Settings className="settingsIcon" onClick={() => Browser.runtime.openOptionsPage()} />
                </div>
            </header>
            <div className="contentWrap">
                <button
                    className="sidepanel-btn"
                    // @ts-ignore
                    onClick={() => { window.close(); chrome.windows.getCurrent(w => chrome.sidePanel.open({ windowId: w.id }))}}
                >
                    Open Side Panel
                </button>
            </div>
            <div className="versionInfo">
                <span className="versionNumber">{VERSION}</span>
            </div>
            <footer>
                <div className="footerContent">
                    <h4><a href="https://waffy.io/" target="_blank" rel="noopener noreferrer">Visit our site</a></h4>
                    <a href="https://github.com/WaffyHQ" target="_blank" rel="noopener noreferrer">
                        <Github className="githubIcon" />
                    </a>
                </div>
            </footer>
        </>
    );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);