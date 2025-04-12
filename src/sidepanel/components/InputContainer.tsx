import { useEffect, useRef } from 'react';
import { InputContainerProps } from '../../types';
import { SUPPORTED_TYPES, MAX_UPLOAD_SIZE } from '../../config';
import toast from 'react-hot-toast';

const InputContainer: React.FC<InputContainerProps> = ({
    isGenerating,
    isRecording,
    textareaRef,
    fileInputRef,
    message,
    files,
    setMessage,
    setFiles,
    onSpeechRecognition,
    onSendMessage,
    onStopGeneration,
}) => {
    const fileInputIconRef = useRef<HTMLButtonElement>(null);
    const microphoneIconRef = useRef<HTMLButtonElement>(null);
    const sendIconRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (textareaRef.current) textareaRef.current.focus();
    }, []);
    
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
            textareaRef.current.focus();
        }
    }, [message]);

    const handleKeyDown = async (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSendMessage();
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            if (Array.from(e.target.files).every(file => SUPPORTED_TYPES.includes(file.type))) {
                if (Array.from(e.target.files).every(file => file.size <= MAX_UPLOAD_SIZE)) {
                    const newFiles = Array.from(e.target.files);
                    setFiles(prev => [...prev, ...newFiles]);
                } else {
                    toast.error("File Size Exceeded", { duration: 3000 });
                }
            } else {
                toast.error("Unsupported File Type", { duration: 3000 });
            }
        }
    };

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    return (
        <div className="input-container">
            <div className="input-box">
                <textarea
                    ref={textareaRef}
                    className="input-textarea"
                    placeholder="Type a message..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    disabled={!!(isGenerating || isRecording)}
                />
                <div className="input-buttons">
                    {isGenerating ? (
                        <button
                            className="action-button stop-button"
                            onClick={onStopGeneration}
                            title="Stop generating"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M464 256A208 208 0 1 0 48 256a208 208 0 1 0 416 0zM0 256a256 256 0 1 1 512 0A256 256 0 1 1 0 256zm192-96l128 0c17.7 0 32 14.3 32 32l0 128c0 17.7-14.3 32-32 32l-128 0c-17.7 0-32-14.3-32-32l0-128c0-17.7 14.3-32 32-32z" /></svg>
                        </button>
                    ) : (
                        <>
                            <input
                                ref={fileInputRef}
                                type="file"
                                style={{ display: "none" }}
                                multiple
                                accept={SUPPORTED_TYPES.join(",")}
                                onChange={handleFileUpload}
                            />
                            <button
                                ref={fileInputIconRef}
                                className="action-button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={!!(isGenerating || isRecording)}
                                title="Attach files"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M364.2 83.8c-24.4-24.4-64-24.4-88.4 0l-184 184c-42.1 42.1-42.1 110.3 0 152.4s110.3 42.1 152.4 0l152-152c10.9-10.9 28.7-10.9 39.6 0s10.9 28.7 0 39.6l-152 152c-64 64-167.6 64-231.6 0s-64-167.6 0-231.6l184-184c46.3-46.3 121.3-46.3 167.6 0s46.3 121.3 0 167.6l-176 176c-28.6 28.6-75 28.6-103.6 0s-28.6-75 0-103.6l144-144c10.9-10.9 28.7-10.9 39.6 0s10.9 28.7 0 39.6l-144 144c-6.7 6.7-6.7 17.7 0 24.4s17.7 6.7 24.4 0l176-176c24.4-24.4 24.4-64 0-88.4z" /></svg>
                            </button>
                            {message === "" ? (
                                <button
                                    ref={microphoneIconRef}
                                    className="action-button"
                                    onClick={onSpeechRecognition}
                                    title="Microphone"
                                    disabled={!!(isGenerating || isRecording)}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path d="M192 0C139 0 96 43 96 96l0 160c0 53 43 96 96 96s96-43 96-96l0-160c0-53-43-96-96-96zM64 216c0-13.3-10.7-24-24-24s-24 10.7-24 24l0 40c0 89.1 66.2 162.7 152 174.4l0 33.6-48 0c-13.3 0-24 10.7-24 24s10.7 24 24 24l72 0 72 0c13.3 0 24-10.7 24-24s-10.7-24-24-24l-48 0 0-33.6c85.8-11.7 152-85.3 152-174.4l0-40c0-13.3-10.7-24-24-24s-24 10.7-24 24l0 40c0 70.7-57.3 128-128 128s-128-57.3-128-128l0-40z" /></svg>
                                </button>
                            ) : (
                                <button
                                    ref={sendIconRef}
                                    className="action-button"
                                    onClick={onSendMessage}
                                    disabled={!!(isGenerating || isRecording)}
                                    title="Send"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M498.1 5.6c10.1 7 15.4 19.1 13.5 31.2l-64 416c-1.5 9.7-7.4 18.2-16 23s-18.9 5.4-28 1.6L284 427.7l-68.5 74.1c-8.9 9.7-22.9 12.9-35.2 8.1S160 493.2 160 480l0-83.6c0-4 1.5-7.8 4.2-10.8L331.8 202.8c5.8-6.3 5.6-16-.4-22s-15.7-6.4-22-.7L106 360.8 17.7 316.6C7.1 311.3 .3 300.7 0 288.9s5.9-22.8 16.1-28.7l448-256c10.7-6.1 23.9-5.5 34 1.4z" /></svg>
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
            {files.length > 0 && (
                <div id="file-preview-container">
                    {files.map((file, index) => (
                        <div key={`${file.name}-${index}`} className="input-file-preview">
                            {file.type.startsWith("image/") ? (
                                <img
                                    src={URL.createObjectURL(file)}
                                    className="input-file-thubmnail"
                                    alt={file.name}
                                />
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path d="M0 64C0 28.7 28.7 0 64 0L224 0l0 128c0 17.7 14.3 32 32 32l128 0 0 288c0 35.3-28.7 64-64 64L64 512c-35.3 0-64-28.7-64-64L0 64zm384 64l-128 0L256 0 384 128z" /></svg>
                            )}
                            <span className="input-file-preview-name" title={file.name}>{file.name}</span>
                            <span className="input-remove-file" onClick={() => removeFile(index)}><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z" /></svg></span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default InputContainer;