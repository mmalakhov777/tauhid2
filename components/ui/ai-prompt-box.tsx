import React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowUp, Paperclip, Square, X, StopCircle, Mic, Globe, BrainCog, FolderCode } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import { useTranslations } from '@/lib/i18n';

// Utility function for className merging
const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(" ");

// Embedded CSS for minimal custom styles
const styles = `
  *:focus-visible {
    outline-offset: 0 !important;
    --ring-offset: 0 !important;
  }
  textarea::-webkit-scrollbar {
    width: 6px;
  }
  textarea::-webkit-scrollbar-track {
    background: transparent;
  }
  textarea::-webkit-scrollbar-thumb {
    background-color: hsl(var(--muted-foreground));
    border-radius: 3px;
  }
  textarea::-webkit-scrollbar-thumb:hover {
    background-color: hsl(var(--foreground));
  }
`;

// Inject styles into document
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);
}

// Textarea Component
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string;
}
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => (
  <textarea
    className={cn(
      "flex w-full rounded-md border-none bg-transparent px-3 py-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 min-h-[56px] resize-none",
      className
    )}
    ref={ref}
    rows={1}
    {...props}
  />
));
Textarea.displayName = "Textarea";

// Tooltip Components
const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;
const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-50 overflow-hidden rounded-md border border-border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className
    )}
    {...props}
  />
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

// Dialog Components
const Dialog = DialogPrimitive.Root;
const DialogPortal = DialogPrimitive.Portal;
const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-[90vw] md:max-w-[800px] translate-x-[-50%] translate-y-[-50%] gap-4 border border-border bg-background p-0 shadow-xl duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 rounded-2xl",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 z-10 rounded-full bg-muted/80 p-2 hover:bg-muted transition-all">
        <X className="h-5 w-5 text-muted-foreground hover:text-foreground" />
        <span className="sr-only">{useTranslations().t('chat.close')}</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight text-foreground", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

// Button Component
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const variantClasses = {
      default: "bg-primary hover:bg-primary/90 text-primary-foreground",
      outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
      ghost: "bg-transparent hover:bg-accent hover:text-accent-foreground",
    };
    const sizeClasses = {
      default: "h-10 px-4 py-2",
      sm: "h-8 px-3 text-sm",
      lg: "h-12 px-6",
      icon: "h-8 w-8 rounded-full aspect-[1/1]",
    };
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

// ImageViewDialog Component
interface ImageViewDialogProps {
  imageUrl: string | null;
  onClose: () => void;
}
const ImageViewDialog: React.FC<ImageViewDialogProps> = ({ imageUrl, onClose }) => {
  const { t } = useTranslations();
  if (!imageUrl) return null;
  return (
    <Dialog open={!!imageUrl} onOpenChange={onClose}>
      <DialogContent className="p-0 border-none bg-transparent shadow-none max-w-[90vw] md:max-w-[800px]">
        <DialogTitle className="sr-only">{t('chat.imagePreview')}</DialogTitle>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative bg-background rounded-2xl overflow-hidden shadow-2xl"
        >
          <img
            src={imageUrl}
            alt={t('chat.fullPreview')}
            className="w-full max-h-[80vh] object-contain rounded-2xl"
          />
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};

// PromptInput Context and Components
interface PromptInputContextType {
  isLoading: boolean;
  value: string;
  setValue: (value: string) => void;
  maxHeight: number | string;
  onSubmit?: () => void;
  disabled?: boolean;
}
const PromptInputContext = React.createContext<PromptInputContextType>({
  isLoading: false,
  value: "",
  setValue: () => {},
  maxHeight: 240,
  onSubmit: undefined,
  disabled: false,
});
function usePromptInput() {
  const context = React.useContext(PromptInputContext);
  if (!context) throw new Error("usePromptInput must be used within a PromptInput");
  return context;
}

interface PromptInputProps {
  isLoading?: boolean;
  value?: string;
  onValueChange?: (value: string) => void;
  maxHeight?: number | string;
  onSubmit?: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}
const PromptInput = React.forwardRef<HTMLDivElement, PromptInputProps>(
  (
    {
      className,
      isLoading = false,
      maxHeight = 240,
      value,
      onValueChange,
      onSubmit,
      children,
      disabled = false,
      onDragOver,
      onDragLeave,
      onDrop,
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = React.useState(value || "");
    const handleChange = (newValue: string) => {
      setInternalValue(newValue);
      onValueChange?.(newValue);
    };
    return (
      <TooltipProvider>
        <PromptInputContext.Provider
          value={{
            isLoading,
            value: value ?? internalValue,
            setValue: onValueChange ?? handleChange,
            maxHeight,
            onSubmit,
            disabled,
          }}
        >
          <div
            ref={ref}
            className={cn(
              "rounded-3xl p-3 transition-all duration-300",
              // Default styling that can be overridden - use transparent background
              !className?.includes('bg-') && "bg-white/10 backdrop-blur-md",
              // Default border styling - will be overridden by className if needed
              "border border-white/20",
              // Add border for loading state
              isLoading && "border-destructive/70",
              className
            )}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            {children}
          </div>
        </PromptInputContext.Provider>
      </TooltipProvider>
    );
  }
);
PromptInput.displayName = "PromptInput";

interface PromptInputTextareaProps {
  disableAutosize?: boolean;
  placeholder?: string;
}
const PromptInputTextarea: React.FC<PromptInputTextareaProps & React.ComponentProps<typeof Textarea>> = ({
  className,
  onKeyDown,
  disableAutosize = false,
  placeholder,
  ...props
}) => {
  const { value, setValue, maxHeight, onSubmit, disabled } = usePromptInput();
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (disableAutosize || !textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height =
      typeof maxHeight === "number"
        ? `${Math.min(textareaRef.current.scrollHeight, maxHeight)}px`
        : `min(${textareaRef.current.scrollHeight}px, ${maxHeight})`;
  }, [value, maxHeight, disableAutosize]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit?.();
    }
    onKeyDown?.(e);
  };

  return (
    <Textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      className={cn("text-base", className)}
      disabled={disabled}
      placeholder={placeholder}
      {...props}
    />
  );
};

interface PromptInputActionsProps extends React.HTMLAttributes<HTMLDivElement> {}
const PromptInputActions: React.FC<PromptInputActionsProps> = ({ children, className, ...props }) => (
  <div className={cn("flex items-center gap-2", className)} {...props}>
    {children}
  </div>
);

interface PromptInputActionProps {
  tooltip: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}
const PromptInputAction: React.FC<PromptInputActionProps> = ({
  tooltip,
  children,
  className,
  side = "top",
}) => {
  const { disabled } = usePromptInput();
  return (
    <Tooltip>
      <TooltipTrigger asChild disabled={disabled}>
        {children}
      </TooltipTrigger>
      <TooltipContent side={side} className={className}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
};

// VoiceRecorder Component
interface VoiceRecorderProps {
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: (duration: number) => void;
  visualizerBars?: number;
  audioStream?: MediaStream | null;
}
const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  isRecording,
  onStartRecording,
  onStopRecording,
  visualizerBars = 32,
  audioStream,
}) => {
  const [time, setTime] = React.useState(0);
  const [audioLevels, setAudioLevels] = React.useState<number[]>(new Array(visualizerBars).fill(0));
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);
  const timeRef = React.useRef<number>(0); // Track time without causing re-renders
  const animationFrameRef = React.useRef<number>();
  const audioContextRef = React.useRef<AudioContext>();
  const analyserRef = React.useRef<AnalyserNode>();

  React.useEffect(() => {
    if (isRecording && audioStream) {
      // Reset timer when starting
      timeRef.current = 0;
      setTime(0);
      
      // Start timer
      timerRef.current = setInterval(() => {
        timeRef.current += 1;
        setTime(timeRef.current);
      }, 1000);
      
      // Set up audio analysis
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 64; // Small FFT for responsive visualization
      analyserRef.current.smoothingTimeConstant = 0.3; // Smooth transitions
      
      const source = audioContextRef.current.createMediaStreamSource(audioStream);
      source.connect(analyserRef.current);
      
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      
      const updateVisualization = () => {
        if (!analyserRef.current || !isRecording) return;
        
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Create smooth bar heights based on frequency data
        const levels = [];
        const barCount = visualizerBars;
        const samplesPerBar = Math.floor(dataArray.length / barCount);
        
        for (let i = 0; i < barCount; i++) {
          let sum = 0;
          for (let j = 0; j < samplesPerBar; j++) {
            sum += dataArray[i * samplesPerBar + j];
          }
          const average = sum / samplesPerBar;
          // Normalize to 0-100 range with minimum height
          const normalized = Math.max(10, (average / 255) * 100);
          levels.push(normalized);
        }
        
        setAudioLevels(levels);
        animationFrameRef.current = requestAnimationFrame(updateVisualization);
      };
      
      updateVisualization();
    } else if (!isRecording) {
      // Clean up when recording stops
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {
          // Ignore errors when closing AudioContext
        });
      }
      
      // Call onStopRecording with the final time value
      if (timeRef.current > 0) {
        onStopRecording(timeRef.current);
      }
      
      // Reset audio levels with smooth transition
      setAudioLevels(new Array(visualizerBars).fill(0));
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {
          // Ignore errors when closing AudioContext
        });
      }
    };
  }, [isRecording, audioStream, visualizerBars, onStopRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center w-full transition-all duration-300",
        isRecording ? "opacity-100 py-3" : "opacity-0 h-0 overflow-hidden"
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
        <span className="font-mono text-sm text-foreground/80">{formatTime(time)}</span>
      </div>
      <div className="w-full h-10 flex items-center justify-center gap-0.5 px-4">
        {audioLevels.map((level, i) => (
          <div
            key={i}
            className="w-0.5 rounded-full bg-foreground/50 transition-all duration-75 ease-out"
            style={{
              height: `${level}%`,
              opacity: 0.5 + (level / 100) * 0.5, // Dynamic opacity based on level
            }}
          />
        ))}
      </div>
    </div>
  );
};

// Main PromptInputBox Component
interface PromptInputBoxProps {
  onSend?: (message: string, files?: File[]) => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
  onAttachmentClick?: () => void;
  attachmentCount?: number;
  showStopButton?: boolean;
  onStopClick?: () => void;
}
export const PromptInputBox = React.forwardRef((props: PromptInputBoxProps, ref: React.Ref<HTMLDivElement>) => {
  const { 
    onSend = () => {}, 
    isLoading = false, 
    placeholder, 
    className,
    onAttachmentClick,
    attachmentCount = 0,
    showStopButton = false,
    onStopClick
  } = props;
  const [input, setInput] = React.useState("");
  const [isRecording, setIsRecording] = React.useState(false);
  const [isTranscribing, setIsTranscribing] = React.useState(false);
  const [audioStream, setAudioStream] = React.useState<MediaStream | null>(null);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const audioChunksRef = React.useRef<Blob[]>([]);
  const promptBoxRef = React.useRef<HTMLDivElement>(null);
  const { t } = useTranslations();

  const handleSubmit = () => {
    if (input.trim()) {
      onSend(input, []);
      setInput("");
    }
  };

  const startRecording = async () => {
    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAudioStream(stream); // Store the stream for visualizer
      
      // Create MediaRecorder instance
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      // Collect audio data chunks
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      // Handle recording stop
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Stop all audio tracks
        stream.getTracks().forEach(track => track.stop());
        setAudioStream(null); // Clear the stream
        
        // Send to transcription API
        await transcribeAudio(audioBlob);
      };
      
      // Start recording
      mediaRecorder.start();
      setIsRecording(true);
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Unable to access microphone. Please check your permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob);
      
      const response = await fetch('/api/voice-transcribe', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Transcription failed');
      }
      
      const data = await response.json();
      
      if (data.text) {
        // Append transcribed text to existing input
        setInput(prevInput => {
          const newText = prevInput ? `${prevInput} ${data.text}` : data.text;
          return newText;
        });
      }
      
    } catch (error) {
      console.error('Transcription error:', error);
      alert(t('chat.transcriptionFailed'));
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleVoiceClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleStartRecording = () => {
    // This is called by VoiceRecorder when recording starts
    console.log(t('chat.recordingStarted'));
  };

  const handleStopRecording = (duration: number) => {
    // This is called by VoiceRecorder when recording stops with duration
    console.log(`${t('chat.recordingStopped')} ${duration} seconds`);
  };

  const hasContent = input.trim() !== "";

  return (
    <PromptInput
      value={input}
      onValueChange={setInput}
      isLoading={isLoading}
      onSubmit={handleSubmit}
      className={cn(
        "w-full shadow-lg transition-all duration-300 ease-in-out",
        isRecording && "ring-2 ring-destructive ring-offset-2",
        className
      )}
      disabled={isLoading || isTranscribing}
      ref={ref || promptBoxRef}
    >
      {/* Show textarea when not recording, hide when recording */}
      <div className={cn(
        "transition-all duration-300",
        isRecording ? "h-0 overflow-hidden opacity-0" : "opacity-100"
      )}>
        <PromptInputTextarea
          placeholder={isTranscribing ? t('chat.transcribing') : placeholder || t('chat.typeMessageHere')}
          className="text-base"
        />
      </div>

      {/* Voice Recorder Animation */}
      <VoiceRecorder
        isRecording={isRecording}
        onStartRecording={handleStartRecording}
        onStopRecording={handleStopRecording}
        audioStream={audioStream}
      />

      <PromptInputActions className="flex items-center justify-end gap-2 p-0 pt-2">
        {/* Attachment count indicator */}
        {attachmentCount > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 bg-muted rounded-full text-xs text-muted-foreground">
            <Paperclip className="h-3 w-3" />
            <span>{attachmentCount}</span>
          </div>
        )}

        {/* Attachment Button */}
        {onAttachmentClick && (
          <PromptInputAction tooltip={t('chat.attachFiles')}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full bg-transparent hover:bg-accent text-muted-foreground hover:text-accent-foreground"
              onClick={(e) => {
                e.preventDefault();
                onAttachmentClick();
              }}
              disabled={isLoading || isRecording || isTranscribing}
              type="button"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
          </PromptInputAction>
        )}

        {/* Stop Button */}
        {showStopButton && onStopClick && (
          <PromptInputAction tooltip={t('chat.stopGeneration')}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full bg-transparent hover:bg-accent text-destructive hover:text-destructive"
              onClick={(e) => {
                e.preventDefault();
                onStopClick();
              }}
              type="button"
            >
              <Square className="h-4 w-4" />
            </Button>
          </PromptInputAction>
        )}

        {/* Submit/Voice Button */}
        {!showStopButton && (
          <PromptInputAction
            tooltip={
              isLoading
                ? t('chat.generating')
                : isTranscribing
                ? t('chat.transcribingAudio')
                : isRecording
                ? t('chat.stopRecording')
                : hasContent
                ? t('chat.sendMessage')
                : t('chat.startVoiceInput')
            }
          >
            <Button
              variant="default"
              size={hasContent && !isRecording && !isTranscribing ? "icon" : "default"}
              className={cn(
                "rounded-full transition-all duration-200",
                hasContent && !isRecording && !isTranscribing
                  ? "h-8 w-8 bg-primary hover:bg-primary/90 text-primary-foreground"
                  : isRecording
                  ? "h-8 px-3 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                  : isTranscribing
                  ? "h-8 px-3 bg-muted text-muted-foreground"
                  : "h-8 px-3 bg-muted hover:bg-accent text-muted-foreground hover:text-accent-foreground"
              )}
              onClick={(e) => {
                e.preventDefault();
                if (hasContent && !isRecording && !isTranscribing) {
                  handleSubmit();
                } else if (!hasContent || isRecording) {
                  handleVoiceClick();
                }
              }}
              disabled={isLoading || isTranscribing}
              type="button"
            >
              {isLoading || isTranscribing ? (
                <>
                <Square className="h-4 w-4 animate-pulse" />
                  {isTranscribing && <span className="ml-2 text-sm">{t('chat.transcribing')}</span>}
                </>
              ) : isRecording ? (
                <>
                <StopCircle className="h-4 w-4" />
                  <span className="ml-2 text-sm">{t('chat.stop')}</span>
                </>
              ) : hasContent && !isRecording ? (
                <ArrowUp className="h-4 w-4" />
              ) : (
                <>
                <Mic className="h-4 w-4" />
                  <span className="ml-2 text-sm">{t('chat.speak')}</span>
                </>
              )}
            </Button>
          </PromptInputAction>
        )}
      </PromptInputActions>
    </PromptInput>
  );
});
PromptInputBox.displayName = "PromptInputBox";