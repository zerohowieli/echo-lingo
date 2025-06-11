"use client";

import { useState, useEffect } from "react";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { WebDAVConfigDialog } from "@/app/components/webdav/webdav-config";
import { FileVideo, FileText, Folder, Upload, Cloud, ChevronUp, Loader2, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/app/components/ui/dialog";
import { toast } from "sonner";

interface FileInfo {
  name: string;
  url: string;
  type: "video" | "subtitle";
}

interface WebDAVFile {
  filename: string;
  path: string;
  type: string;
  size: number;
  lastmod: string;
}

interface FileSelectorProps {
  onVideoSelect: (url: string) => void;
  onSubtitleOneSelect: (url: string) => void;
  onSubtitleTwoSelect: (url: string) => void;
}

type FileType = "video" | "subtitle1" | "subtitle2";

// 视频文件扩展名
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.m4v'];
// 字幕文件扩展名
const SUBTITLE_EXTENSIONS = ['.srt', '.vtt', '.ass', '.ssa', '.sub'];

// 检查文件类型
const isVideoFile = (filename: string): boolean => {
  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
  return VIDEO_EXTENSIONS.includes(ext);
};

const isSubtitleFile = (filename: string): boolean => {
  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
  return SUBTITLE_EXTENSIONS.includes(ext);
};

// 处理长文件名，超过maxLength个字符时中间部分省略
const truncateFilename = (filename: string, maxLength = 45): string => {
  if (filename.length <= maxLength) return filename;
  
  const extension = filename.includes('.') ? filename.substring(filename.lastIndexOf('.')) : '';
  const nameWithoutExt = filename.substring(0, filename.length - extension.length);
  
  // 计算前后部分的长度，保留扩展名
  const frontPartLength = Math.floor((maxLength - 3 - extension.length) / 2);
  const endPartLength = maxLength - 3 - extension.length - frontPartLength;
  
  // 构建省略的文件名
  return `${nameWithoutExt.substring(0, frontPartLength)}...${nameWithoutExt.substring(nameWithoutExt.length - endPartLength)}${extension}`;
};

export function FileSelector({
  onVideoSelect,
  onSubtitleOneSelect,
  onSubtitleTwoSelect,
}: FileSelectorProps) {
  const [currentFileType, setCurrentFileType] = useState<FileType | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isWebDAVBrowseOpen, setIsWebDAVBrowseOpen] = useState(false);
  const [webdavFiles, setWebdavFiles] = useState<WebDAVFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentFolder, setCurrentFolder] = useState("/");
  const [folderHistory, setFolderHistory] = useState<string[]>([]);
  const [webDAVConfigExists, setWebDAVConfigExists] = useState(false);
  const [selectedFile, setSelectedFile] = useState<WebDAVFile | null>(null);
  
  // 文件类型显示名称
  const fileTypeNames = {
    video: "视频文件",
    subtitle1: "字幕1",
    subtitle2: "字幕2"
  };

  // 检查WebDAV配置是否存在
  useEffect(() => {
    const checkWebDAVConfig = async () => {
      if (typeof window !== 'undefined' && window.electronAPI) {
        try {
          const config = await window.electronAPI.getWebDAVConfig();
          setWebDAVConfigExists(!!config);
        } catch (error) {
          console.error('Error checking WebDAV config:', error);
          setWebDAVConfigExists(false);
        }
      }
    };
    
    checkWebDAVConfig();
  }, []);

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

  // 浏览WebDAV文件
  const browseWebDAVFiles = async (path = '/') => {
    setIsLoading(true);
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        const result = await window.electronAPI.getWebDAVDirectoryContents(path);
        
        if (result.success) {
          // 对文件进行排序：目录优先，然后按文件名字母排序
          const sortedFiles = [...(result.contents || [])].sort((a, b) => {
            // 首先按类型排序（目录优先）
            if (a.type === 'directory' && b.type !== 'directory') return -1;
            if (a.type !== 'directory' && b.type === 'directory') return 1;
            
            // 然后按文件名字母排序（不区分大小写）
            return a.filename.localeCompare(b.filename, undefined, { sensitivity: 'base' });
          });
          
          setWebdavFiles(sortedFiles);
          setCurrentFolder(path);
        } else {
          toast.error('获取WebDAV文件列表失败', {
            description: result.error || '未知错误'
          });
        }
      }
    } catch (error) {
      console.error("Error browsing WebDAV files:", error);
      toast.error('获取WebDAV文件列表失败', {
        description: '发生错误，请稍后重试'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 打开WebDAV文件夹
  const openWebDAVFolder = (path: string) => {
    // 保存当前路径到历史记录
    setFolderHistory(prev => [...prev, currentFolder]);
    // 清空选中的文件
    setSelectedFile(null);
    browseWebDAVFiles(path);
  };

  // 返回上一级目录
  const goToParentFolder = () => {
    if (folderHistory.length > 0) {
      const previousFolder = folderHistory[folderHistory.length - 1];
      setFolderHistory(prev => prev.slice(0, -1));
      // 清空选中的文件
      setSelectedFile(null);
      browseWebDAVFiles(previousFolder);
    }
  };

  // 选择WebDAV文件
  const selectWebDAVFile = async (file: WebDAVFile) => {
    if (!currentFileType) return;
    
    // 如果是文件夹，打开文件夹
    if (file.type === 'directory') {
      openWebDAVFolder(file.path);
      return;
    }
    
    // 根据当前选择的文件类型和文件扩展名进行验证
    const isVideo = isVideoFile(file.filename);
    const isSubtitle = isSubtitleFile(file.filename);
    
    if ((currentFileType === 'video' && !isVideo) || 
        ((currentFileType === 'subtitle1' || currentFileType === 'subtitle2') && !isSubtitle)) {
      toast.error('文件类型不匹配', {
        description: `请选择${currentFileType === 'video' ? '视频' : '字幕'}文件`
      });
      return;
    }
    
    // 设置当前选中的文件，显示确认对话框
    setSelectedFile(file);
  };
  
  // 确认选择文件
  const confirmFileSelection = async () => {
    if (!selectedFile || !currentFileType) return;
    
    setIsLoading(true);
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        // 先关闭对话框，避免用户等待
        setIsWebDAVBrowseOpen(false);
        setIsDialogOpen(false);
        
        const result = await window.electronAPI.getWebDAVFileURL(selectedFile.path);
        
        if (result.success && result.url) {
          switch (currentFileType) {
            case "video":
              onVideoSelect(result.url);
              break;
            case "subtitle1":
              onSubtitleOneSelect(result.url);
              break;
            case "subtitle2":
              onSubtitleTwoSelect(result.url);
              break;
          }
          
          // 提示用户选择成功
          toast.success('文件选择成功', {
            description: `已选择${selectedFile.filename}`
          });
        } else {
          toast.error('获取文件失败', {
            description: result.error || '未知错误'
          });
        }
      }
    } catch (error) {
      console.error("Error selecting WebDAV file:", error);
      toast.error('获取文件失败', {
        description: '发生错误，请稍后重试'
      });
    } finally {
      setIsLoading(false);
      setSelectedFile(null);
    }
  };

  // 打开文件选择对话框
  const openFileSelector = (fileType: FileType) => {
    setCurrentFileType(fileType);
    setIsDialogOpen(true);
  };
  
  // 打开WebDAV浏览
  const openWebDAVBrowser = () => {
    if (!webDAVConfigExists) {
      toast.error('WebDAV未配置', {
        description: '请先配置WebDAV连接信息'
      });
      return;
    }
    
    // 重置文件夹历史和当前文件夹
    setFolderHistory([]);
    setCurrentFolder('/');
    setIsWebDAVBrowseOpen(true);
    browseWebDAVFiles('/');
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
                  accept={currentFileType === "video" ? "video/*" : ".srt,.vtt,.ass,.ssa,.sub"}
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
        <Dialog open={isWebDAVBrowseOpen} onOpenChange={(open) => {
          if (!open) {
            setSelectedFile(null);
          }
          setIsWebDAVBrowseOpen(open);
        }}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>浏览WebDAV文件</DialogTitle>
              <DialogDescription>
                当前路径: {currentFolder}
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span className="ml-2">加载中...</span>
                </div>
              ) : (
                <>
                  {/* 导航按钮 */}
                  {folderHistory.length > 0 && (
                    <Button 
                      variant="outline" 
                      onClick={goToParentFolder} 
                      className="mb-4"
                    >
                      <ChevronUp className="mr-2 h-4 w-4" />
                      返回上一级
                    </Button>
                  )}
                  
                  {/* 文件列表 */}
                  <div className="max-h-80 overflow-y-auto border rounded-md">
                    {webdavFiles.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        此文件夹为空
                      </div>
                    ) : (
                      <ul className="divide-y">
                        {webdavFiles.map((file, index) => {
                          // 确定文件图标和是否可选
                          const isDirectory = file.type === 'directory';
                          const isVideo = isVideoFile(file.filename);
                          const isSubtitle = isSubtitleFile(file.filename);
                          const isSelectable = 
                            isDirectory || 
                            (currentFileType === 'video' && isVideo) || 
                            ((currentFileType === 'subtitle1' || currentFileType === 'subtitle2') && isSubtitle);
                          
                          // 处理长文件名
                          const displayFilename = truncateFilename(file.filename);
                          
                          return (
                            <li
                              key={`file-${index}`}
                              className={`flex items-center gap-2 p-3 hover:bg-accent ${isSelectable ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'} ${selectedFile?.path === file.path ? 'bg-accent' : ''}`}
                              onClick={() => isSelectable && selectWebDAVFile(file)}
                              title={file.filename}
                            >
                              {isDirectory ? (
                                <Folder className="h-5 w-5 text-blue-500" />
                              ) : isVideo ? (
                                <FileVideo className="h-5 w-5 text-purple-500" />
                              ) : isSubtitle ? (
                                <FileText className="h-5 w-5 text-green-500" />
                              ) : (
                                <FileText className="h-5 w-5" />
                              )}
                              <span className="text-sm flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{displayFilename}</span>
                              {!isDirectory && (
                                <span className="text-xs text-muted-foreground shrink-0">
                                  {(file.size / 1024 / 1024).toFixed(2)} MB
                                </span>
                              )}
                              {selectedFile?.path === file.path && !isDirectory && (
                                <Check className="h-4 w-4 text-green-500 shrink-0" />
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                  
                  {/* 确认选择按钮 */}
                  {selectedFile && selectedFile.type !== 'directory' && (
                    <div className="mt-4 flex justify-end">
                      <Button 
                        onClick={confirmFileSelection}
                        disabled={isLoading}
                        className="flex items-center gap-2"
                        title={selectedFile.filename}
                      >
                        <Check className="h-4 w-4" />
                        确认选择: {truncateFilename(selectedFile.filename, 30)}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
} 