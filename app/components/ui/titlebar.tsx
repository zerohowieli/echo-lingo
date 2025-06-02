"use client";

import { X, Minus, Square } from "lucide-react";
import { useState, useEffect } from "react";

// 定义窗口控制 API 接口
interface WindowControlAPI {
  minimizeWindow: () => void;
  toggleMaximizeWindow: () => void;
  closeWindow: () => void;
  isWindowMaximized: () => Promise<boolean>;
  onMaximizeChange: (callback: (maximized: boolean) => void) => void;
  removeMaximizeListener: () => void;
}

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);

  // 检查窗口是否最大化
  useEffect(() => {
    const checkMaximized = async () => {
      if (typeof window !== "undefined" && window.electronAPI) {
        try {
          // 使用类型断言
          const api = window.electronAPI as unknown as WindowControlAPI;
          const maximized = await api.isWindowMaximized();
          setIsMaximized(maximized);
        } catch (error) {
          console.error("Failed to check window maximize state:", error);
        }
      }
    };

    checkMaximized();

    // 监听窗口最大化状态变化
    const handleMaximizeChange = (maximized: boolean) => {
      setIsMaximized(maximized);
    };

    if (typeof window !== "undefined" && window.electronAPI) {
      try {
        // 使用类型断言
        const api = window.electronAPI as unknown as WindowControlAPI;
        api.onMaximizeChange(handleMaximizeChange);
      } catch (error) {
        console.error("Failed to add maximize change listener:", error);
      }
    }

    return () => {
      if (typeof window !== "undefined" && window.electronAPI) {
        try {
          // 使用类型断言
          const api = window.electronAPI as unknown as WindowControlAPI;
          api.removeMaximizeListener();
        } catch (error) {
          console.error("Failed to remove maximize change listener:", error);
        }
      }
    };
  }, []);

  // 最小化窗口
  const minimizeWindow = () => {
    if (typeof window !== "undefined" && window.electronAPI) {
      try {
        // 使用类型断言
        const api = window.electronAPI as unknown as WindowControlAPI;
        api.minimizeWindow();
      } catch (error) {
        console.error("Failed to minimize window:", error);
      }
    }
  };

  // 最大化/还原窗口
  const toggleMaximizeWindow = () => {
    if (typeof window !== "undefined" && window.electronAPI) {
      try {
        // 使用类型断言
        const api = window.electronAPI as unknown as WindowControlAPI;
        api.toggleMaximizeWindow();
      } catch (error) {
        console.error("Failed to toggle maximize window:", error);
      }
    }
  };

  // 关闭窗口
  const closeWindow = () => {
    if (typeof window !== "undefined" && window.electronAPI) {
      try {
        // 使用类型断言
        const api = window.electronAPI as unknown as WindowControlAPI;
        api.closeWindow();
      } catch (error) {
        console.error("Failed to close window:", error);
      }
    }
  };

  return (
    <div className="h-8 bg-background border-b flex justify-between items-center select-none">
      <div 
        className="flex-1 app-drag-region h-full" 
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      ></div>
      <div className="flex items-center">
        <button
          onClick={minimizeWindow}
          className="h-8 w-12 inline-flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          onClick={toggleMaximizeWindow}
          className="h-8 w-12 inline-flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          <Square className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={closeWindow}
          className="h-8 w-12 inline-flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
} 