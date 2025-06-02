"use client";

import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { WebDAVConfigDialog } from "@/app/components/webdav/webdav-config";
import { FileVideo, FileText, Folder, Upload, Cloud } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/app/components/ui/dialog";

interface FileInfo {
  name: string;
  url: string;
  type: "video" | "subtitle";
}

interface FileSelectorProps {
  onVideoSelect: (url: string) => void;
  onSubtitleOneSelect: (url: string) => void;
  onSubtitleTwoSelect: (url: string) => void;
}

type FileType = "video" | "subtitle1" | "subtitle2";

export function FileSelector({
  onVideoSelect,
  onSubtitleOneSelect,
  onSubtitleTwoSelect,
}: FileSelectorProps) {
  const [currentFileType, setCurrentFileType] = useState<FileType | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isWebDAVBrowseOpen, setIsWebDAVBrowseOpen] = useState(false);
  const [webdavFiles, setWebdavFiles] = useState<FileInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentFolder, setCurrentFolder] = useState("/");
  
  // 文件类型显示名称
  const fileTypeNames = {
    video: "视频文件",
    subtitle1: "字幕1",
    subtitle2: "字幕2"
  };

  // 处理本地文件选择
  const handleLocalFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    fileType: FileType
  ) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);

      switch (fileType) {
        case "video":
          onVideoSelect(url);
          break;
        case "subtitle1":
          onSubtitleOneSelect(url);
          break;
        case "subtitle2":
          onSubtitleTwoSelect(url);
          break;
      }
      
      // 关闭对话框
      setIsDialogOpen(false);
    }
  };

  // 浏览WebDAV文件（模拟，实际需要实现WebDAV客户端）
  const browseWebDAVFiles = async () => {
    setIsLoading(true);
    try {
      // 这里是模拟的WebDAV文件列表，实际应用中需要使用WebDAV客户端获取
      setTimeout(() => {
        setWebdavFiles([
          { name: "示例视频.mp4", url: "https://example.com/video.mp4", type: "video" },
          { name: "英文字幕.srt", url: "https://example.com/en.srt", type: "subtitle" },
          { name: "中文字幕.srt", url: "https://example.com/zh.srt", type: "subtitle" },
        ]);
        setIsLoading(false);
      }, 1000);
    } catch (error) {
      console.error("Error browsing WebDAV files:", error);
      setIsLoading(false);
    }
  };

  // 选择WebDAV文件
  const selectWebDAVFile = (file: FileInfo) => {
    if (!currentFileType) return;
    
    switch (currentFileType) {
      case "video":
        if (file.type === "video") {
          onVideoSelect(file.url);
        }
        break;
      case "subtitle1":
        if (file.type === "subtitle") {
          onSubtitleOneSelect(file.url);
        }
        break;
      case "subtitle2":
        if (file.type === "subtitle") {
          onSubtitleTwoSelect(file.url);
        }
        break;
    }
    
    // 关闭WebDAV浏览和文件选择对话框
    setIsWebDAVBrowseOpen(false);
    setIsDialogOpen(false);
  };
  
  // 打开文件选择对话框
  const openFileSelector = (fileType: FileType) => {
    setCurrentFileType(fileType);
    setIsDialogOpen(true);
  };
  
  // 打开WebDAV浏览
  const openWebDAVBrowser = () => {
    setIsWebDAVBrowseOpen(true);
    browseWebDAVFiles();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>文件选择</CardTitle>
        <WebDAVConfigDialog />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <Button 
            variant="outline" 
            className="flex flex-col items-center justify-center py-6 h-auto"
            onClick={() => openFileSelector("video")}
          >
            <FileVideo className="h-8 w-8 mb-2" />
            <span>选择视频</span>
          </Button>
          <Button 
            variant="outline" 
            className="flex flex-col items-center justify-center py-6 h-auto"
            onClick={() => openFileSelector("subtitle1")}
          >
            <FileText className="h-8 w-8 mb-2" />
            <span>选择字幕1</span>
          </Button>
          <Button 
            variant="outline" 
            className="flex flex-col items-center justify-center py-6 h-auto"
            onClick={() => openFileSelector("subtitle2")}
          >
            <FileText className="h-8 w-8 mb-2" />
            <span>选择字幕2</span>
          </Button>
        </div>
        
        {/* 文件选择对话框 */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>选择{currentFileType ? fileTypeNames[currentFileType] : ""}</DialogTitle>
              <DialogDescription>
                请选择文件来源
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid grid-cols-2 gap-4 py-4">
              <div>
                <Button 
                  variant="outline" 
                  className="w-full h-32 flex flex-col items-center justify-center"
                  onClick={() => {
                    // 触发隐藏的文件输入框
                    const fileInput = document.getElementById(`${currentFileType}-file-input`);
                    if (fileInput) {
                      fileInput.click();
                    }
                  }}
                >
                  <Upload className="h-8 w-8 mb-2" />
                  <span>本地文件</span>
                </Button>
                {/* 隐藏的文件输入框 */}
                <Input
                  id={`${currentFileType}-file-input`}
                  type="file"
                  accept={currentFileType === "video" ? "video/*" : ".srt,.vtt"}
                  onChange={(e) => currentFileType && handleLocalFileChange(e, currentFileType)}
                  className="hidden"
                />
              </div>
              
              <div>
                <Button 
                  variant="outline" 
                  className="w-full h-32 flex flex-col items-center justify-center"
                  onClick={openWebDAVBrowser}
                >
                  <Cloud className="h-8 w-8 mb-2" />
                  <span>WebDAV</span>
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        
        {/* WebDAV浏览对话框 */}
        <Dialog open={isWebDAVBrowseOpen} onOpenChange={setIsWebDAVBrowseOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>浏览WebDAV文件</DialogTitle>
              <DialogDescription>
                当前路径: {currentFolder}
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-4">
              {isLoading ? (
                <div className="text-center py-8">加载中...</div>
              ) : (
                <div className="max-h-80 overflow-y-auto">
                  <ul className="space-y-1">
                    {webdavFiles.map((file, index) => (
                      <li
                        key={index}
                        className="flex items-center gap-2 p-2 hover:bg-accent rounded-md cursor-pointer"
                        onClick={() => selectWebDAVFile(file)}
                      >
                        {file.type === "video" ? (
                          <FileVideo className="h-4 w-4" />
                        ) : (
                          <FileText className="h-4 w-4" />
                        )}
                        <span className="text-sm">{file.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsWebDAVBrowseOpen(false)}>
                取消
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
} 