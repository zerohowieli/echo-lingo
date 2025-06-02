"use client";

import { useState, useRef, useEffect } from "react";
import { FileSelector } from "@/app/components/player/file-selector";
import { VideoPlayer } from "@/app/components/player/video-player";
import { SubtitleList, SubtitleListRef } from "@/app/components/subtitle/subtitle-list";

export default function Home() {
  const [videoUrl, setVideoUrl] = useState<string | undefined>();
  const [subtitleOneUrl, setSubtitleOneUrl] = useState<string | undefined>();
  const [subtitleTwoUrl, setSubtitleTwoUrl] = useState<string | undefined>();
  const [videoHeight, setVideoHeight] = useState<number>(0);
  const playerRef = useRef<any>(null);
  const subtitleListRef = useRef<SubtitleListRef>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  // 处理字幕摘录
  const handleCaptureSubtitle = (subtitle: { text: string; start: number; end: number }) => {
    // 使用ref调用子组件的方法
    subtitleListRef.current?.addSubtitle(subtitle);
  };

  // 播放特定时间段的视频
  const handlePlaySubtitle = (start: number, end: number) => {
    if (playerRef.current) {
      playerRef.current.seekTo(start);
      // 这里可以实现自动播放到end时间后暂停的逻辑
    }
  };

  // 监听视频容器高度变化
  useEffect(() => {
    if (!videoContainerRef.current) return;

    const updateHeight = () => {
      if (videoContainerRef.current) {
        setVideoHeight(videoContainerRef.current.clientHeight);
      }
    };

    // 初始化高度
    updateHeight();

    // 创建 ResizeObserver 监听元素大小变化
    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(videoContainerRef.current);

    // 监听窗口大小变化
    window.addEventListener('resize', updateHeight);

    return () => {
      if (videoContainerRef.current) {
        resizeObserver.unobserve(videoContainerRef.current);
      }
      window.removeEventListener('resize', updateHeight);
    };
  }, []);

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4 text-center">EchoLingo - 语言学习助手</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* 左侧：视频播放器 */}
        <div className="md:col-span-2" ref={videoContainerRef}>
          <VideoPlayer
            videoUrl={videoUrl}
            subtitleOneUrl={subtitleOneUrl}
            subtitleTwoUrl={subtitleTwoUrl}
            onCaptureSubtitle={handleCaptureSubtitle}
            ref={playerRef}
          />
        </div>
        
        {/* 右侧：字幕摘录 */}
        <div className="md:col-span-1" style={{ height: videoHeight ? `${videoHeight}px` : '400px' }}>
          <SubtitleList 
            ref={subtitleListRef}
            onPlaySubtitle={handlePlaySubtitle} 
          />
        </div>
      </div>
      
      <div className="mt-4">
        <FileSelector
          onVideoSelect={setVideoUrl}
          onSubtitleOneSelect={setSubtitleOneUrl}
          onSubtitleTwoSelect={setSubtitleTwoUrl}
        />
      </div>
    </main>
  );
}
