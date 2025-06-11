"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Settings } from "lucide-react";
import { toast } from "sonner";

// 确保 TypeScript 识别 window.electronAPI
declare global {
  interface Window {
    electronAPI: {
      saveWebDAVConfig: (config: WebDAVConfig) => Promise<{ success: boolean; error?: string }>;
      getWebDAVConfig: () => Promise<WebDAVConfig | null>;
      testWebDAVConnection: (config: WebDAVConfig) => Promise<{ success: boolean; error?: string }>;
      getWebDAVDirectoryContents: (path: string) => Promise<{ 
        success: boolean; 
        contents?: Array<{
          filename: string;
          path: string;
          type: string;
          size: number;
          lastmod: string;
        }>;
        error?: string 
      }>;
      getWebDAVFileURL: (filePath: string) => Promise<{ success: boolean; url?: string; error?: string }>;
    };
  }
}

interface WebDAVConfig {
  protocol: string;
  server: string;
  port: string;
  path: string;
  username: string;
  password: string;
}

// 默认配置
const DEFAULT_CONFIG: WebDAVConfig = {
  protocol: "https",
  server: "openapi.alipan.com",
  port: "443",
  path: "/dav",
  username: "",
  password: "",
};

export function WebDAVConfigDialog() {
  const [config, setConfig] = useState<WebDAVConfig>({...DEFAULT_CONFIG});
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 加载已保存的配置
  useEffect(() => {
    const loadConfig = async () => {
      try {
        if (typeof window !== "undefined" && window.electronAPI) {
          const savedConfig = await window.electronAPI.getWebDAVConfig();
          if (savedConfig) {
            setConfig(savedConfig);
          }
        }
      } catch (error) {
        console.error("Failed to load WebDAV config:", error);
      }
    };

    if (isOpen) {
      loadConfig();
    }
  }, [isOpen]);

  // 表单验证
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    // 验证服务器地址
    if (!config.server.trim()) {
      config.server = DEFAULT_CONFIG.server;
    }
    
    // 验证端口
    if (!config.port.trim()) {
      config.port = config.protocol === "https" ? "443" : "80";
    } else if (!/^\d+$/.test(config.port)) {
      newErrors.port = "端口必须是数字";
    }
    
    // 验证路径
    if (!config.path.trim()) {
      config.path = DEFAULT_CONFIG.path;
    } else if (!config.path.startsWith("/")) {
      config.path = "/" + config.path;
    }
    
    // 验证用户名和密码
    if (!config.username.trim()) {
      newErrors.username = "请输入用户名";
    }
    
    if (!config.password.trim()) {
      newErrors.password = "请输入密码";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // 清除相关字段的错误
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
    
    // 协议和端口联动
    if (name === "protocol") {
      setConfig((prev) => ({
        ...prev,
        [name]: value,
        port: value === "https" ? "443" : "80"
      }));
    } else {
      setConfig((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSave = async () => {
    // 验证表单
    if (!validateForm()) {
      toast.error("表单验证失败", {
        description: "请修正表单中的错误后重试",
      });
      return;
    }
    
    setIsLoading(true);
    try {
      if (typeof window !== "undefined" && window.electronAPI) {
        const result = await window.electronAPI.saveWebDAVConfig(config);
        if (result.success) {
          setIsOpen(false);
          toast.success("WebDAV 配置已保存");
        } else {
          toast.error("保存失败", {
            description: result.error || "未知错误",
          });
          console.error("Failed to save WebDAV config:", result.error);
        }
      }
    } catch (error) {
      console.error("Error saving WebDAV config:", error);
      toast.error("保存失败", {
        description: "发生错误，请稍后重试",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTest = async () => {
    // 验证表单
    if (!validateForm()) {
      toast.error("表单验证失败", {
        description: "请修正表单中的错误后重试",
      });
      return;
    }
    
    setIsTesting(true);
    try {
      if (typeof window !== "undefined" && window.electronAPI) {
        const result = await window.electronAPI.testWebDAVConnection(config);
        if (result.success) {
          toast.success("WebDAV 服务器连接测试通过");
        } else {
          toast.error("连接失败", {
            description: result.error || "无法连接到 WebDAV 服务器",
          });
        }
      }
    } catch (error) {
      console.error("Error testing WebDAV connection:", error);
      toast.error("测试失败", {
        description: "发生错误，请稍后重试",
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>WebDAV 配置</DialogTitle>
          <DialogDescription>
            设置您的WebDAV服务器连接信息，这些信息将被加密存储在本地
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="protocol" className="text-right">
              协议
            </label>
            <div className="col-span-3">
              <select
                id="protocol"
                name="protocol"
                value={config.protocol}
                onChange={handleChange}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="https">HTTPS</option>
                <option value="http">HTTP</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="server" className="text-right">
              服务器地址
            </label>
            <div className="col-span-3">
              <Input
                id="server"
                name="server"
                value={config.server}
                onChange={handleChange}
                className="col-span-3"
                placeholder="openapi.alipan.com"
              />
              {errors.server && <p className="text-sm text-red-500 mt-1">{errors.server}</p>}
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="port" className="text-right">
              端口
            </label>
            <div className="col-span-3">
              <Input
                id="port"
                name="port"
                value={config.port}
                onChange={handleChange}
                className="col-span-3"
                placeholder={config.protocol === "https" ? "443" : "80"}
              />
              {errors.port && <p className="text-sm text-red-500 mt-1">{errors.port}</p>}
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="path" className="text-right">
              路径
            </label>
            <div className="col-span-3">
              <Input
                id="path"
                name="path"
                value={config.path}
                onChange={handleChange}
                className="col-span-3"
                placeholder="/dav"
              />
              {errors.path && <p className="text-sm text-red-500 mt-1">{errors.path}</p>}
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="username" className="text-right">
              账号
            </label>
            <div className="col-span-3">
              <Input
                id="username"
                name="username"
                value={config.username}
                onChange={handleChange}
                className="col-span-3"
              />
              {errors.username && <p className="text-sm text-red-500 mt-1">{errors.username}</p>}
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="password" className="text-right">
              密码
            </label>
            <div className="col-span-3">
              <Input
                id="password"
                name="password"
                type="password"
                value={config.password}
                onChange={handleChange}
                className="col-span-3"
              />
              {errors.password && <p className="text-sm text-red-500 mt-1">{errors.password}</p>}
            </div>
          </div>
        </div>
        <DialogFooter className="flex justify-between">
          <Button 
            variant="outline" 
            onClick={handleTest} 
            disabled={isTesting}
          >
            {isTesting ? "测试中..." : "测试连接"}
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 