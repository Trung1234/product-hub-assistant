"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { StandaloneConfig } from "@/lib/config";

interface ConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (config: StandaloneConfig) => void;
  initialConfig?: StandaloneConfig;
}

export function ConfigDialog({
  open,
  onOpenChange,
  onSave,
  initialConfig,
}: ConfigDialogProps) {
  const [deploymentUrl, setDeploymentUrl] = useState(
    initialConfig?.deploymentUrl || "http://127.0.0.1:2024"
  );
  const [assistantId, setAssistantId] = useState(
    initialConfig?.assistantId || "product_opportunity_hub"
  );
  const [langsmithApiKey, setLangsmithApiKey] = useState(
    initialConfig?.langsmithApiKey || ""
  );

  useEffect(() => {
    if (open && initialConfig) {
      setDeploymentUrl(initialConfig.deploymentUrl);
      setAssistantId(initialConfig.assistantId);
      setLangsmithApiKey(initialConfig.langsmithApiKey || "");
    }
  }, [open, initialConfig]);

  const handleSave = () => {
    if (!deploymentUrl || !assistantId) {
      alert("Vui lòng điền đầy đủ các trường bắt buộc");
      return;
    }

    onSave({
      deploymentUrl,
      assistantId,
      langsmithApiKey: langsmithApiKey || undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="sm:max-w-[525px] bg-[#0E1538] border-[#00FF88]/30 text-white shadow-[0_0_40px_rgba(0,255,136,0.2)]">
        <DialogHeader>
          <DialogTitle className="text-white text-base font-bold">Cấu hình hệ thống R&D</DialogTitle>
          <DialogDescription className="text-slate-400 text-xs">
            Cấu hình thông số kết nối LangGraph Server và định danh Agent R&D. Cài đặt được lưu an toàn trong trình duyệt của bạn.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="deploymentUrl" className="text-slate-300 text-xs font-semibold">
              Địa chỉ máy chủ (Deployment URL)
            </Label>
            <Input
              id="deploymentUrl"
              placeholder="http://127.0.0.1:2024"
              value={deploymentUrl}
              onChange={(e) => setDeploymentUrl(e.target.value)}
              className="bg-[#080B21] border-slate-800 text-white text-xs focus:border-[#00FF88]"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="assistantId" className="text-slate-300 text-xs font-semibold">
              Mã Agent (Assistant / Graph ID)
            </Label>
            <Input
              id="assistantId"
              placeholder="product_opportunity_hub"
              value={assistantId}
              onChange={(e) => setAssistantId(e.target.value)}
              className="bg-[#080B21] border-slate-800 text-white text-xs focus:border-[#00FF88]"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="langsmithApiKey" className="text-slate-300 text-xs font-semibold">
              LangSmith API Key{" "}
              <span className="text-slate-500 font-normal">(Tùy chọn)</span>
            </Label>
            <Input
              id="langsmithApiKey"
              type="password"
              placeholder="lsv2_pt_..."
              value={langsmithApiKey}
              onChange={(e) => setLangsmithApiKey(e.target.value)}
              className="bg-[#080B21] border-slate-800 text-white text-xs focus:border-[#00FF88]"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800 text-xs"
          >
            Hủy bỏ
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            className="border border-[#00FF88] bg-[#00FF88] text-[#080B21] hover:bg-[#00FF88]/85 text-xs font-bold shadow-[0_0_15px_rgba(0,255,136,0.3)]"
          >
            Lưu cấu hình
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
