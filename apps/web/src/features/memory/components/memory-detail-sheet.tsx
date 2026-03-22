import type { MemoryEntry } from "@clawview/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { DASHBOARD_QUERY_KEY } from "@/lib/constants";
import { formatRelativeTime } from "@/lib/format";
import { updateMemory } from "@/services/endpoints/memory.api";
import { useToastStore } from "@/stores/toast.store";
import type { DashboardPayload } from "@/types/api";

interface MemoryDetailSheetProps {
  entry: MemoryEntry | null;
  open: boolean;
  onClose: () => void;
}

export function MemoryDetailSheet({
  entry,
  open,
  onClose,
}: MemoryDetailSheetProps) {
  const queryClient = useQueryClient();
  const pushToast = useToastStore((state) => state.push);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState("");

  const editMutation = useMutation({
    mutationFn: (options: { memoryId: string; content: string }) =>
      updateMemory(options.memoryId, { content: options.content }),
    onSuccess: (result) => {
      queryClient.setQueryData<DashboardPayload | undefined>(
        DASHBOARD_QUERY_KEY,
        (current) =>
          current
            ? {
                ...current,
                memory: result.entries,
              }
            : current,
      );

      pushToast(
        result.restart.success ? "记忆已保存并生效。" : result.restart.message,
      );
      setIsEditing(false);
    },
    onError: () => {
      pushToast("保存失败，请稍后重试。");
    },
  });
  const resetEditMutation = editMutation.reset;

  useEffect(() => {
    if (!entry || !open) {
      setIsEditing(false);
      setEditedContent("");
      resetEditMutation();
      return;
    }

    setEditedContent(entry.content);
    resetEditMutation();
  }, [entry, open, resetEditMutation]);

  return (
    <BottomSheet open={open} onClose={onClose} title="记忆详情">
      {entry ? (
        <div className="sheet-stack">
          <div className="list-card memory-sheet-card">
            <strong>{entry.summary}</strong>
            <p>来源：{entry.sourceLabel}</p>
            <p>最后同步：{formatRelativeTime(entry.updatedAt)}</p>
            <p>最近使用：{formatRelativeTime(entry.lastUsedAt)}</p>
          </div>

          <div className="list-card memory-editor-card">
            <label className="field field-memory" htmlFor="memory-content">
              <span>记忆内容</span>
              <textarea
                id="memory-content"
                rows={14}
                value={editedContent}
                readOnly={!isEditing}
                onChange={(event) => setEditedContent(event.target.value)}
              />
            </label>
            <p className="memory-editor-hint">
              已自动去掉 Markdown
              标记，适合在手机上直接查看和修改。点击“应用并重启”后会写回 `clawd`
              并触发网关重启。
            </p>
          </div>

          <div className="memory-action-row memory-action-row-primary">
            {isEditing ? (
              <>
                <Button
                  disabled={
                    editMutation.isPending || editedContent.trim().length === 0
                  }
                  onClick={() =>
                    editMutation.mutate({
                      memoryId: entry.id,
                      content: editedContent.trim(),
                    })
                  }
                >
                  {editMutation.isPending ? "应用中..." : "应用并重启"}
                </Button>
                <Button
                  tone="secondary"
                  disabled={editMutation.isPending}
                  onClick={() => {
                    setIsEditing(false);
                    setEditedContent(entry.content);
                  }}
                >
                  取消
                </Button>
              </>
            ) : (
              <>
                <Button onClick={() => setIsEditing(true)}>编辑内容</Button>
                <Button tone="secondary" onClick={onClose}>
                  关闭
                </Button>
              </>
            )}
          </div>

          {editMutation.isPending ? (
            <div className="inline-status inline-status-loading">
              正在保存记忆并重启桌面端网关...
            </div>
          ) : null}
          {editMutation.isSuccess ? (
            <div className="inline-status inline-status-success">
              记忆已保存，新的内容会立即参与后续会话。
            </div>
          ) : null}
          {editMutation.isError ? (
            <div className="inline-status inline-status-error">
              保存没有成功，请检查本地文件权限或网关状态后重试。
            </div>
          ) : null}
        </div>
      ) : null}
    </BottomSheet>
  );
}
