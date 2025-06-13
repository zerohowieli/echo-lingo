"use client";

import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import ReactPlayer from "react-player";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent } from "@/app/components/ui/card";
import { Pause, Play, SkipBack, SkipForward, Maximize, Minimize, Subtitles, ChevronDown } from "lucide-react";
import { cn } from "@/app/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

// 字幕条目接口
interface SubtitleEntry {
  start: number;
  end: number;
  text: string;
}

interface VideoPlayerProps {
  videoUrl?: string;
  subtitleOneUrl?: string;
  subtitleTwoUrl?: string;
  onCaptureSubtitle: (subtitle: { text: string; start: number; end: number }) => void;
}

export interface VideoPlayerRef {
  seekTo: (time: number) => void;
}

// 定义字幕轨道类型
interface TrackProps {
  kind: string;
  src: string;
  srcLang: string;
  label: string;
  default?: boolean;
}

// 模拟字幕数据
const mockSubtitlesOne = [
  { start: 2, end: 5, text: "Hello, welcome to EchoLingo!" },
  { start: 6, end: 10, text: "This is a language learning tool" },
  { start: 11, end: 15, text: "You can learn languages by watching videos" },
  { start: 16, end: 20, text: "And extract sentences you're interested in" },
  { start: 21, end: 25, text: "Try pressing 'C' to capture this subtitle" },
];

const mockSubtitlesTwo = [
  { start: 2, end: 5, text: "你好，欢迎使用EchoLingo！" },
  { start: 6, end: 10, text: "这是一个语言学习工具" },
  { start: 11, end: 15, text: "你可以通过观看视频学习语言" },
  { start: 16, end: 20, text: "并且可以摘录你感兴趣的句子" },
  { start: 21, end: 25, text: "尝试按下'C'键来摘录当前字幕" },
];

// 倍速选项
const playbackRates = [
  { value: 0.5, label: "0.5x" },
  { value: 0.75, label: "0.75x" },
  { value: 1, label: "1x" },
  { value: 1.5, label: "1.5x" },
  { value: 2, label: "2x" },
];

// 解析SRT字幕文件
const parseSRT = (srtContent: string): SubtitleEntry[] => {
  try {
    const subtitles: SubtitleEntry[] = [];
    const blocks = srtContent.trim().split(/\r?\n\r?\n/);
    
    for (const block of blocks) {
      const lines = block.split(/\r?\n/);
      if (lines.length < 3) continue;
      
      // 跳过字幕序号，直接读取时间轴
      const timeMatch = lines[1].match(/(\d{2}):(\d{2}):(\d{2}),(\d{3}) --> (\d{2}):(\d{2}):(\d{2}),(\d{3})/);
      if (!timeMatch) continue;
      
      const startHours = parseInt(timeMatch[1]);
      const startMinutes = parseInt(timeMatch[2]);
      const startSeconds = parseInt(timeMatch[3]);
      const startMilliseconds = parseInt(timeMatch[4]);
      
      const endHours = parseInt(timeMatch[5]);
      const endMinutes = parseInt(timeMatch[6]);
      const endSeconds = parseInt(timeMatch[7]);
      const endMilliseconds = parseInt(timeMatch[8]);
      
      const startTime = startHours * 3600 + startMinutes * 60 + startSeconds + startMilliseconds / 1000;
      const endTime = endHours * 3600 + endMinutes * 60 + endSeconds + endMilliseconds / 1000;
      
      // 合并剩余行为字幕文本
      const text = lines.slice(2).join(' ');
      
      subtitles.push({
        start: startTime,
        end: endTime,
        text
      });
    }
    
    return subtitles;
  } catch (error) {
    console.error('Error parsing SRT subtitle:', error);
    return [];
  }
};

// 解析VTT字幕文件
const parseVTT = (vttContent: string): SubtitleEntry[] => {
  try {
    const subtitles: SubtitleEntry[] = [];
    // 移除WEBVTT头部
    const content = vttContent.replace(/^WEBVTT.*?(\r?\n\r?\n)/i, '');
    const blocks = content.trim().split(/\r?\n\r?\n/);
    
    for (const block of blocks) {
      const lines = block.split(/\r?\n/);
      if (lines.length < 2) continue;
      
      // 查找时间轴行
      let timeLineIndex = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(' --> ')) {
          timeLineIndex = i;
          break;
        }
      }
      
      const timeMatch = lines[timeLineIndex].match(/(\d{2}):(\d{2}):(\d{2})\.(\d{3}) --> (\d{2}):(\d{2}):(\d{2})\.(\d{3})/);
      if (!timeMatch) continue;
      
      const startHours = parseInt(timeMatch[1]);
      const startMinutes = parseInt(timeMatch[2]);
      const startSeconds = parseInt(timeMatch[3]);
      const startMilliseconds = parseInt(timeMatch[4]);
      
      const endHours = parseInt(timeMatch[5]);
      const endMinutes = parseInt(timeMatch[6]);
      const endSeconds = parseInt(timeMatch[7]);
      const endMilliseconds = parseInt(timeMatch[8]);
      
      const startTime = startHours * 3600 + startMinutes * 60 + startSeconds + startMilliseconds / 1000;
      const endTime = endHours * 3600 + endMinutes * 60 + endSeconds + endMilliseconds / 1000;
      
      // 合并剩余行为字幕文本
      const text = lines.slice(timeLineIndex + 1).join(' ');
      
      subtitles.push({
        start: startTime,
        end: endTime,
        text
      });
    }
    
    return subtitles;
  } catch (error) {
    console.error('Error parsing VTT subtitle:', error);
    return [];
  }
};

export const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(
  ({ videoUrl, subtitleOneUrl, subtitleTwoUrl, onCaptureSubtitle }, ref) => {
    const [playing, setPlaying] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [showSubtitleOne, setShowSubtitleOne] = useState(false);
    const [showSubtitleTwo, setShowSubtitleTwo] = useState(false);
    const [seeking, setSeeking] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [currentSubtitleOne, setCurrentSubtitleOne] = useState<string | null>(null);
    const [currentSubtitleTwo, setCurrentSubtitleTwo] = useState<string | null>(null);
    const [showControls, setShowControls] = useState(true);
    const [controlsTimer, setControlsTimer] = useState<NodeJS.Timeout | null>(null);
    const [subtitlesOne, setSubtitlesOne] = useState<SubtitleEntry[]>(mockSubtitlesOne);
    const [subtitlesTwo, setSubtitlesTwo] = useState<SubtitleEntry[]>(mockSubtitlesTwo);
    const [isLoadingSubtitles, setIsLoadingSubtitles] = useState(false);
    const [videoError, setVideoError] = useState<string | null>(null);
    const playerRef = useRef<ReactPlayer>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // 暴露方法给父组件
    useImperativeHandle(ref, () => ({
      seekTo: (time: number) => {
        const validTime = Math.max(0, Math.min(time, duration));
        playerRef.current?.seekTo(validTime);
        setCurrentTime(validTime);
      }
    }));

    // 加载字幕文件
    useEffect(() => {
      const loadSubtitle = async (url: string, setSubtitles: React.Dispatch<React.SetStateAction<SubtitleEntry[]>>) => {
        try {
          setIsLoadingSubtitles(true);
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Failed to load subtitle: ${response.status}`);
          }
          
          const content = await response.text();
          const fileExtension = url.substring(url.lastIndexOf('.')).toLowerCase();
          
          let parsedSubtitles: SubtitleEntry[] = [];
          if (fileExtension === '.srt') {
            parsedSubtitles = parseSRT(content);
          } else if (fileExtension === '.vtt') {
            parsedSubtitles = parseVTT(content);
          } else {
            // 尝试自动检测格式
            if (content.trim().startsWith('WEBVTT')) {
              parsedSubtitles = parseVTT(content);
            } else {
              parsedSubtitles = parseSRT(content);
            }
          }
          
          if (parsedSubtitles.length > 0) {
            setSubtitles(parsedSubtitles);
          } else {
            toast.error('字幕解析失败', {
              description: '无法解析字幕文件格式'
            });
          }
        } catch (error) {
          console.error('Error loading subtitle:', error);
          toast.error('加载字幕失败', {
            description: '无法加载字幕文件'
          });
        } finally {
          setIsLoadingSubtitles(false);
        }
      };
      
      // 加载字幕1
      if (subtitleOneUrl && subtitleOneUrl !== 'mock') {
        loadSubtitle(subtitleOneUrl, setSubtitlesOne);
      } else if (!subtitleOneUrl) {
        setSubtitlesOne([]);
      }
      
      // 加载字幕2
      if (subtitleTwoUrl && subtitleTwoUrl !== 'mock') {
        loadSubtitle(subtitleTwoUrl, setSubtitlesTwo);
      } else if (!subtitleTwoUrl) {
        setSubtitlesTwo([]);
      }
    }, [subtitleOneUrl, subtitleTwoUrl]);

    // 监听键盘快捷键
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        // 确保事件目标是视频播放器组件或其子元素，或者处于全屏模式
        // 这样可以防止在其他输入框中按下C键时触发摘录功能
        const isTargetInPlayer = 
          containerRef.current?.contains(e.target as Node) || 
          isFullscreen || 
          document.activeElement === document.body;
          
        if (!isTargetInPlayer) {
          return;
        }
        
        // 显示控制栏
        resetControlsTimer();
        
        // 空格键：播放/暂停
        if (e.code === "Space") {
          e.preventDefault();
          setPlaying((prev) => !prev);
        }
        // C键：捕获当前字幕
        else if (e.code === "KeyC") {
          e.preventDefault();
          captureCurrentSubtitle();
        }
        // 左右箭头：快进/快退5秒
        else if (e.code === "ArrowLeft") {
          e.preventDefault();
          seekTo(currentTime - 5);
        }
        else if (e.code === "ArrowRight") {
          e.preventDefault();
          seekTo(currentTime + 5);
        }
        // 数字键1-5：设置播放速度
        else if (e.code === "Digit1") {
          e.preventDefault();
          setPlaybackRate(0.5);
        }
        else if (e.code === "Digit2") {
          e.preventDefault();
          setPlaybackRate(0.75);
        }
        else if (e.code === "Digit3") {
          e.preventDefault();
          setPlaybackRate(1);
        }
        else if (e.code === "Digit4") {
          e.preventDefault();
          setPlaybackRate(1.5);
        }
        else if (e.code === "Digit5") {
          e.preventDefault();
          setPlaybackRate(2);
        }
        // F键：全屏
        else if (e.code === "KeyF") {
          e.preventDefault();
          toggleFullscreen();
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [currentTime, isFullscreen]);

    // 更新当前字幕
    useEffect(() => {
      // 查找当前时间对应的字幕一
      const subtitleOne = subtitlesOne.find(
        sub => currentTime >= sub.start && currentTime <= sub.end
      );
      
      // 查找当前时间对应的字幕二
      const subtitleTwo = subtitlesTwo.find(
        sub => currentTime >= sub.start && currentTime <= sub.end
      );
      
      setCurrentSubtitleOne(subtitleOne ? subtitleOne.text : null);
      setCurrentSubtitleTwo(subtitleTwo ? subtitleTwo.text : null);
    }, [currentTime, subtitlesOne, subtitlesTwo]);

    // 处理鼠标移动，显示控制栏
    const handleMouseMove = () => {
      resetControlsTimer();
    };

    // 重置控制栏隐藏计时器
    const resetControlsTimer = () => {
      setShowControls(true);
      
      if (controlsTimer) {
        clearTimeout(controlsTimer);
      }
      
      // 3秒后隐藏控制栏
      const timer = setTimeout(() => {
        if (isFullscreen) {
          setShowControls(false);
        }
      }, 3000);
      
      setControlsTimer(timer);
    };

    // 清理计时器
    useEffect(() => {
      return () => {
        if (controlsTimer) {
          clearTimeout(controlsTimer);
        }
      };
    }, [controlsTimer]);

    // 捕获当前字幕
    const captureCurrentSubtitle = () => {
      // 根据当前显示的字幕决定捕获哪个字幕
      if (showSubtitleOne && currentSubtitleOne) {
        const subtitle = subtitlesOne.find(
          sub => currentTime >= sub.start && currentTime <= sub.end
        );
        
        if (subtitle) {
          onCaptureSubtitle({
            text: subtitle.text,
            start: subtitle.start,
            end: subtitle.end
          });
          return;
        }
      }
      
      if (showSubtitleTwo && currentSubtitleTwo) {
        const subtitle = subtitlesTwo.find(
          sub => currentTime >= sub.start && currentTime <= sub.end
        );
        
        if (subtitle) {
          onCaptureSubtitle({
            text: subtitle.text,
            start: subtitle.start,
            end: subtitle.end
          });
          return;
        }
      }
      
      // 如果没有找到字幕，提示用户
      toast.error('没有找到当前字幕', {
        description: '请确保字幕已加载并且当前时间点有字幕显示'
      });
    };

    const seekTo = (time: number) => {
      const validTime = Math.max(0, Math.min(time, duration));
      playerRef.current?.seekTo(validTime);
      setCurrentTime(validTime);
    };

    const handleProgress = (state: { playedSeconds: number }) => {
      if (!seeking) {
        setCurrentTime(state.playedSeconds);
      }
    };

    const handleDuration = (duration: number) => {
      setDuration(duration);
    };

    const formatTime = (seconds: number) => {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      return `${h > 0 ? `${h}:` : ""}${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    };

    const handleSeekMouseDown = () => {
      setSeeking(true);
    };

    const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const time = parseFloat(e.target.value);
      setCurrentTime(time);
    };

    const handleSeekMouseUp = (e: React.MouseEvent<HTMLInputElement> | React.TouchEvent<HTMLInputElement>) => {
      setSeeking(false);
      const target = e.target as HTMLInputElement;
      const time = parseFloat(target.value);
      seekTo(time);
    };

    // 准备字幕轨道
    const prepareTracks = () => {
      const tracks: TrackProps[] = [];
      
      if (subtitleOneUrl && showSubtitleOne) {
        tracks.push({
          kind: "subtitles",
          src: subtitleOneUrl,
          srcLang: "en",
          label: "字幕1",
          default: true
        });
      }
      
      if (subtitleTwoUrl && showSubtitleTwo) {
        tracks.push({
          kind: "subtitles",
          src: subtitleTwoUrl,
          srcLang: "zh",
          label: "字幕2"
        });
      }
      
      return tracks;
    };
    
    // 切换全屏
    const toggleFullscreen = () => {
      if (!containerRef.current) return;
      
      if (!isFullscreen) {
        if (containerRef.current.requestFullscreen) {
          containerRef.current.requestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        }
      }
      
      setIsFullscreen(!isFullscreen);
    };
    
    // 监听全屏变化
    useEffect(() => {
      const handleFullscreenChange = () => {
        setIsFullscreen(!!document.fullscreenElement);
        
        // 全屏状态变化时重置控制栏显示
        resetControlsTimer();
      };
      
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);
    
    // 切换字幕显示状态
    const toggleSubtitle = (type: 'one' | 'two') => {
      if (type === 'one') {
        setShowSubtitleOne(!showSubtitleOne);
      } else {
        setShowSubtitleTwo(!showSubtitleTwo);
      }
    };
    
    // 渲染字幕显示
    const renderSubtitles = () => {
      // 如果两个字幕都不显示，则不渲染
      if (!showSubtitleOne && !showSubtitleTwo) {
        return null;
      }
      
      return (
        <div className={cn(
          "absolute left-0 right-0 text-center flex flex-col items-center space-y-2 z-20",
          isFullscreen ? "bottom-24" : "bottom-4"
        )}>
          {showSubtitleOne && currentSubtitleOne && (
            <div className="text-white px-2 py-1 text-lg max-w-[80%] font-bold subtitle-text">
              {currentSubtitleOne}
            </div>
          )}
          {showSubtitleTwo && currentSubtitleTwo && (
            <div className="text-white px-2 py-1 text-lg max-w-[80%] font-bold subtitle-text">
              {currentSubtitleTwo}
            </div>
          )}
        </div>
      );
    };

    // 处理视频加载错误
    const handleVideoError = (error: any) => {
      console.error("Video playback error:", error);
      setVideoError("视频加载失败，请检查文件格式或网络连接");
      toast.error("视频加载失败", {
        description: "请检查文件格式或网络连接"
      });
    };

    return (
      <Card className="w-full">
        <CardContent className={cn("p-4", isFullscreen && "p-0")}>
          <div 
            ref={containerRef}
            className={cn(
              "relative bg-black rounded-md overflow-hidden",
              isFullscreen ? "w-screen h-screen" : "aspect-video"
            )}
            onMouseMove={handleMouseMove}
          >
            {videoUrl ? (
              <>
                <ReactPlayer
                  ref={playerRef}
                  url={videoUrl}
                  width="100%"
                  height="100%"
                  playing={playing}
                  playbackRate={playbackRate}
                  onProgress={handleProgress}
                  onDuration={handleDuration}
                  onError={handleVideoError}
                  config={{
                    file: {
                      tracks: prepareTracks(),
                      forceVideo: true,
                      forceAudio: true,
                      attributes: { controlsList: 'nodownload' }
                    },
                  }}
                />
                
                {/* 视频错误显示 */}
                {videoError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-white text-center p-4">
                    <div>
                      <p className="text-lg font-bold mb-2">播放错误</p>
                      <p>{videoError}</p>
                      <Button 
                        variant="outline" 
                        className="mt-4 text-white border-white hover:bg-white/20"
                        onClick={() => setVideoError(null)}
                      >
                        关闭
                      </Button>
                    </div>
                  </div>
                )}
                
                {/* 自定义字幕显示 */}
                {renderSubtitles()}
                
                {/* 全屏时的控制栏 */}
                {isFullscreen && (showControls || seeking) && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/30 backdrop-blur-sm p-2 z-30">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm text-white min-w-[40px]">{formatTime(currentTime)}</span>
                      <input
                        type="range"
                        min={0}
                        max={duration}
                        step="any"
                        value={currentTime}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        onChange={handleSeekChange}
                        onMouseDown={handleSeekMouseDown}
                        onMouseUp={handleSeekMouseUp}
                        onTouchStart={handleSeekMouseDown}
                        onTouchEnd={handleSeekMouseUp}
                      />
                      <span className="text-sm text-white min-w-[40px]">{formatTime(duration)}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => seekTo(currentTime - 10)}
                          className="text-white hover:bg-white/20 h-8 w-8"
                        >
                          <SkipBack className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setPlaying(!playing)}
                          className="text-white hover:bg-white/20 h-8 w-8"
                        >
                          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => seekTo(currentTime + 10)}
                          className="text-white hover:bg-white/20 h-8 w-8"
                        >
                          <SkipForward className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {/* 全屏模式下只显示当前倍速，不使用下拉框 */}
                        <div className="text-white text-sm bg-black/40 px-2 py-1 rounded-sm">
                          {playbackRate}x
                        </div>
                        
                        <Button
                          variant={showSubtitleOne ? "default" : "ghost"}
                          size="sm"
                          onClick={() => toggleSubtitle('one')}
                          className={cn(
                            "text-white h-7",
                            showSubtitleOne 
                              ? "bg-black/40 border border-white/70 hover:bg-black/60" 
                              : "hover:bg-white/20"
                          )}
                        >
                          <Subtitles className="h-4 w-4 mr-1" />
                          英文
                        </Button>
                        <Button
                          variant={showSubtitleTwo ? "default" : "ghost"}
                          size="sm"
                          onClick={() => toggleSubtitle('two')}
                          className={cn(
                            "text-white h-7",
                            showSubtitleTwo 
                              ? "bg-black/40 border border-white/70 hover:bg-black/60" 
                              : "hover:bg-white/20"
                          )}
                        >
                          <Subtitles className="h-4 w-4 mr-1" />
                          中文
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={toggleFullscreen}
                          className="text-white hover:bg-white/20 h-8 w-8"
                        >
                          <Minimize className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center w-full h-full">
                <p className="text-white">请选择视频文件</p>
              </div>
            )}
          </div>

          {!isFullscreen && (
            <>
              {/* 进度条 */}
              <div className="mt-2 px-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm min-w-[40px]">{formatTime(currentTime)}</span>
                  <input
                    type="range"
                    min={0}
                    max={duration}
                    step="any"
                    value={currentTime}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    onChange={handleSeekChange}
                    onMouseDown={handleSeekMouseDown}
                    onMouseUp={handleSeekMouseUp}
                    onTouchStart={handleSeekMouseDown}
                    onTouchEnd={handleSeekMouseUp}
                  />
                  <span className="text-sm min-w-[40px]">{formatTime(duration)}</span>
                </div>
              </div>

              <div className="mt-2 flex flex-col space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => seekTo(currentTime - 10)}
                    >
                      <SkipBack className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setPlaying(!playing)}
                    >
                      {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => seekTo(currentTime + 10)}
                    >
                      <SkipForward className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={toggleFullscreen}
                      title="全屏 (F)"
                    >
                      <Maximize className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPlaybackRate(0.5)}
                      className={cn(
                        playbackRate === 0.5 && "bg-gray-200 text-gray-900"
                      )}
                    >
                      0.5x
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPlaybackRate(0.75)}
                      className={cn(
                        playbackRate === 0.75 && "bg-gray-200 text-gray-900"
                      )}
                    >
                      0.75x
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPlaybackRate(1)}
                      className={cn(
                        playbackRate === 1 && "bg-gray-200 text-gray-900"
                      )}
                    >
                      1x
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPlaybackRate(1.5)}
                      className={cn(
                        playbackRate === 1.5 && "bg-gray-200 text-gray-900"
                      )}
                    >
                      1.5x
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPlaybackRate(2)}
                      className={cn(
                        playbackRate === 2 && "bg-gray-200 text-gray-900"
                      )}
                    >
                      2x
                    </Button>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <Button
                    variant="outline"
                    onClick={() => toggleSubtitle('one')}
                    disabled={!subtitleOneUrl && !subtitlesOne.length}
                    className={cn(
                      "flex items-center gap-2 transition-colors",
                      showSubtitleOne && "bg-gray-200 text-gray-900"
                    )}
                  >
                    <Subtitles className={cn("h-4 w-4", showSubtitleOne ? "text-gray-900" : "text-slate-500")} />
                    字幕1
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => toggleSubtitle('two')}
                    disabled={!subtitleTwoUrl && !subtitlesTwo.length}
                    className={cn(
                      "flex items-center gap-2 transition-colors",
                      showSubtitleTwo && "bg-gray-200 text-gray-900"
                    )}
                  >
                    <Subtitles className={cn("h-4 w-4", showSubtitleTwo ? "text-gray-900" : "text-slate-500")} />
                    字幕2
                  </Button>
                  <Button
                    variant="outline"
                    onClick={captureCurrentSubtitle}
                  >
                    摘录当前字幕 (C)
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    );
  }
);

VideoPlayer.displayName = "VideoPlayer"; 