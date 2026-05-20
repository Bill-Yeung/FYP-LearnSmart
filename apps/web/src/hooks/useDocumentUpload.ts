import { useState, useCallback } from "react";
import { UPLOAD } from "../../../../shared/constants";
import { useToast } from "../contexts/ToastContext";
import { apiClient } from "../lib/api";

type UseDocumentUploadReturn = {
  files: File[];
  setFiles: React.Dispatch<React.SetStateAction<File[]>>;
  validateFile: (file: File) => string | null;
  handleFileSelect: (newFiles: File[]) => void;
  handleUpload: (
    uploadMode: "file" | "text",
    options: {
      textContent?: string;
      title?: string;
      selectedSubjectIds?: string[];
    }
  ) => Promise<string[] | void>;
};

export function useDocumentUpload(): UseDocumentUploadReturn {
  const [files, setFiles] = useState<File[]>([]);
  const { showToast } = useToast();

  const validateFile = useCallback((file: File): string | null => {
    if (file.size > UPLOAD.maxFileSize) {
      return `File too large. Maximum size is ${Math.round(
        UPLOAD.maxFileSize / 1024 / 1024
      )}MB`;
    }
    return null;
  }, []);

  const handleFileSelect = useCallback(
    (newFiles: File[]) => {
      const validFiles: File[] = [];
      for (const file of newFiles) {
        const validationError = validateFile(file);
        if (validationError) {
          showToast(validationError);
          continue;
        }
        validFiles.push(file);
      }
      if (validFiles.length > 0) {
        setFiles((prev) => [...prev, ...validFiles]);
      }
    },
    [validateFile, showToast]
  );

  const handleUpload = useCallback(
    async (
      uploadMode: "file" | "text",
      { textContent, title, selectedSubjectIds = [] }: {
        textContent?: string;
        title?: string;
        selectedSubjectIds?: string[];
      }
    ) => {
      if (uploadMode === "file" && files.length === 0) {
        showToast("Please select at least one file to upload");
        return;
      }
      if (uploadMode === "text" && !textContent?.trim()) {
        showToast("Please enter some text content");
        return;
      }
      if (uploadMode === "text" && !title?.trim()) {
        showToast("Please enter a title");
        return;
      }

      try {
        const uploadedIds: string[] = [];

        const extractIds = (res: any) => {
          const ids: string[] = [];
          if (!res) return ids;
          if (Array.isArray(res)) {
            for (const item of res) {
              if (item && (item as any).document_id) ids.push(String((item as any).document_id));
              else if (item && (item as any).id) ids.push(String((item as any).id));
              else if (typeof item === "string") ids.push(item);
            }
            return ids;
          }
          if (typeof res === "object") {
            if ((res as any).document_id) ids.push(String((res as any).document_id));
            else if ((res as any).id) ids.push(String((res as any).id));
          } else if (typeof res === "string") {
            ids.push(res);
          }
          return ids;
        };

        if (uploadMode === "text") {
          const formData = new FormData();
          formData.append("title", title!.trim());
          formData.append("is_public", "false");
          formData.append("content", textContent!);
          if (selectedSubjectIds.length > 0) {
            formData.append("subject_ids", selectedSubjectIds.join(","));
          }

          const res = await apiClient.upload("/api/documents/upload", formData);
          showToast(`"${title}" uploaded successfully! Processing started.`);
          const ids = extractIds(res);
          uploadedIds.push(...ids);
        } else {
          let successCount = 0;
          const errors: string[] = [];

          for (const file of files) {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("is_public", "false");
            if (selectedSubjectIds.length > 0) {
              formData.append("subject_ids", selectedSubjectIds.join(","));
            }

            try {
              const res = await apiClient.upload("/api/documents/upload", formData);
              successCount++;
              const ids = extractIds(res);
              uploadedIds.push(...ids);
            } catch (err) {
              errors.push(
                `${file.name}: ${
                  err instanceof Error ? err.message : "Analysis failed"
                }`
              );
            }
          }

          if (successCount > 0) {
            showToast(
              `${successCount} file(s) uploaded successfully! Processing started.`
            );
          }
          if (errors.length > 0) {
            throw new Error(errors.join("\n"));
          }
        }

        return uploadedIds.length > 0 ? uploadedIds : undefined;
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : "Failed to upload documents."
        );
        return undefined;
      }
    },
    [files, showToast]
  );

  return {
    files,
    setFiles,
    validateFile,
    handleFileSelect,
  handleUpload,
  };
}