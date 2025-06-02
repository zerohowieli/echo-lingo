"use client";

import { useState, useRef, useImperativeHandle, forwardRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Trash2 } from "lucide-react";

interface SubtitleItem {
  id: string;
  text: string;
  start: number;
  end: number;
}

interface SubtitleListProps {
  onPlaySubtitle: (start: number, end: number) => void;
}

export interface SubtitleListRef {
  addSubtitle: (subtitle: { text: string; start: number; end: number }) => void;
}

export const SubtitleList = forwardRef<SubtitleListRef, SubtitleListProps>(
  ({ onPlaySubtitle }, ref) => {
    const [subtitles, setSubtitles] = useState<SubtitleItem[]>([]);

    // 暴露方法给父组件
    useImperativeHandle(ref, () => ({
      addSubtitle: (subtitle: { text: string; start: number; end: number }) => {
        const newSubtitle: SubtitleItem = {
          id: Date.now().toString(),
          ...subtitle,
        };
        setSubtitles((prev) => [...prev, newSubtitle]);
      }
    }));

    // 删除字幕
    const removeSubtitle = (id: string) => {
      setSubtitles((prev) => prev.filter((item) => item.id !== id));
    };

    // 格式化时间
    const formatTime = (seconds: number) => {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      const ms = Math.floor((seconds % 1) * 1000);
      return `${h > 0 ? `${h}:` : ""}${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
    };

    return (
      <Card className="w-full h-full flex flex-col">
        <CardHeader className="pb-2 flex-shrink-0">
          <CardTitle>字幕摘录</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 flex-grow overflow-hidden">
          {subtitles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground h-full flex items-center justify-center">
              使用键盘快捷键 "C" 摘录当前播放的字幕
            </div>
          ) : (
            <div className="h-full overflow-y-auto pr-1">
              <ul className="space-y-2">
                {subtitles.map((subtitle) => (
                  <li
                    key={subtitle.id}
                    className="p-3 border rounded-md hover:bg-accent cursor-pointer group"
                  >
                    <div className="flex justify-between items-start">
                      <div 
                        className="flex-1"
                        onClick={() => onPlaySubtitle(subtitle.start, subtitle.end)}
                      >
                        <p className="mb-1">{subtitle.text}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatTime(subtitle.start)} - {formatTime(subtitle.end)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeSubtitle(subtitle.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
);

SubtitleList.displayName = "SubtitleList"; 