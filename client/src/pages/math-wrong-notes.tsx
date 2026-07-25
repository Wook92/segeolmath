import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { UserRole } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ManualButton } from "@/components/manual-button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus, Minus, Upload, Wand2, Save, Trash2, Printer, Download, ArrowLeft,
  Loader2, BookOpen, FileText, Users, Search, AlertTriangle,
  Folder, FolderOpen, FolderPlus, ChevronRight, MoveRight, MoreVertical, Pencil
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const COST_PER_PAGE = 90;

function resolveImageUrl(page: { imageUrl: string; r2ObjectKey?: string | null }): string {
  if (page.imageUrl.startsWith("http")) {
    return page.imageUrl;
  }
  return `/api/r2-proxy/${page.r2ObjectKey || page.imageUrl}`;
}

type Box = {
  id: string;
  x: number; y: number; w: number; h: number;
  problemNumber: string;
  checked: boolean;
  existingProblemId?: string;
};

type ProblemData = {
  id: string;
  pageId: string;
  problemNumber: string;
  label?: string | null;
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
};

type PageData = {
  id: string;
  workbookId: string;
  pageNumber: number;
  imageUrl: string;
  r2ObjectKey: string | null;
  width: number;
  height: number;
  detectionStatus: string | null;
  isPaid?: boolean;
  problems?: ProblemData[];
};

type WorkbookItem = {
  id: string;
  centerId: string;
  title: string;
  createdBy: string;
  totalPages: number;
  paidPages: number;
  folderId: string | null;
  pageCount: number;
  wrongNoteCount: number;
  creatorName: string;
  createdAt: string;
};

type WrongNoteItem = {
  id: string;
  title: string;
  workbookId: string;
  createdBy: string;
  createdByRole?: string | null;
  creatorName: string;
  itemCount: number;
  studentCount: number;
  createdAt: string;
  assignerName?: string | null;
  assignedAt?: string | null;
  folderId?: string | null;
};

function PageBoxEditor({
  page,
  boxes,
  onChange,
  paidPage,
  detecting = false,
  maxHeight = "calc(100vh - 200px)",
  onPageNumberChange,
}: {
  page: PageData;
  boxes: Box[];
  onChange: (boxes: Box[]) => void;
  paidPage: boolean;
  detecting?: boolean;
  maxHeight?: string;
  onPageNumberChange?: (pageId: string, newPageNumber: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [dragging, setDragging] = useState<{ startX: number; startY: number; boxId?: string; resizeDir?: string } | null>(null);
  const [dragBox, setDragBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const imageUrl = resolveImageUrl(page);

  const handleImageLoad = useCallback(() => {
    if (imageRef.current && containerRef.current) {
      const displayW = imageRef.current.clientWidth;
      const newScale = displayW / page.width;
      console.log(`[PageBoxEditor] Image loaded for page ${page.id}: displayW=${displayW}, page.width=${page.width}, scale=${newScale}`);
      setScale(newScale);
    } else {
      console.log(`[PageBoxEditor] Image load but refs missing: imageRef=${!!imageRef.current}, containerRef=${!!containerRef.current}`);
    }
  }, [page.width, page.id]);

  useEffect(() => {
    const handleResize = () => {
      if (imageRef.current) {
        const displayW = imageRef.current.clientWidth;
        setScale(displayW / page.width);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [page.width]);

  const getRelCoordsFromClient = (clientX: number, clientY: number) => {
    if (!imageRef.current) return { x: 0, y: 0 };
    const rect = imageRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / scale,
      y: (clientY - rect.top) / scale,
    };
  };

  const getRelCoords = (e: React.MouseEvent) => getRelCoordsFromClient(e.clientX, e.clientY);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!paidPage) return;
    if ((e.target as HTMLElement).closest(".box-control")) return;
    const coords = getRelCoords(e);
    setDragging({ startX: coords.x, startY: coords.y });
    setDragBox({ x: coords.x, y: coords.y, w: 0, h: 0 });
    e.preventDefault();
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !paidPage) return;
    const coords = getRelCoords(e);
    const x = Math.min(dragging.startX, coords.x);
    const y = Math.min(dragging.startY, coords.y);
    const w = Math.abs(coords.x - dragging.startX);
    const h = Math.abs(coords.y - dragging.startY);
    setDragBox({ x, y, w, h });
  };

  const handleMouseUp = () => {
    if (dragBox && dragBox.w > 20 && dragBox.h > 20 && paidPage) {
      const newBox: Box = {
        id: `new-${Date.now()}`,
        x: dragBox.x, y: dragBox.y, w: dragBox.w, h: dragBox.h,
        problemNumber: String(boxes.length + 1),
        checked: false,
      };
      onChange([...boxes, newBox]);
    }
    setDragging(null);
    setDragBox(null);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!paidPage) return;
    if ((e.target as HTMLElement).closest(".box-control")) return;
    const touch = e.touches[0];
    const coords = getRelCoordsFromClient(touch.clientX, touch.clientY);
    setDragging({ startX: coords.x, startY: coords.y });
    setDragBox({ x: coords.x, y: coords.y, w: 0, h: 0 });
    e.preventDefault();
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!dragging || !paidPage) return;
    const touch = e.touches[0];
    const coords = getRelCoordsFromClient(touch.clientX, touch.clientY);
    const x = Math.min(dragging.startX, coords.x);
    const y = Math.min(dragging.startY, coords.y);
    const w = Math.abs(coords.x - dragging.startX);
    const h = Math.abs(coords.y - dragging.startY);
    setDragBox({ x, y, w, h });
    e.preventDefault();
  };

  const handleTouchEnd = () => {
    handleMouseUp();
  };

  const updateBox = (id: string, updates: Partial<Box>) => {
    onChange(boxes.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const removeBox = (id: string) => {
    onChange(boxes.filter(b => b.id !== id));
  };

  const toggleCheck = (id: string) => {
    if (!paidPage) return;
    onChange(boxes.map(b => b.id === id ? { ...b, checked: !b.checked } : b));
  };

  return (
    <div className="relative" ref={containerRef}>
      {detecting && (
        <div className="absolute inset-0 z-30 bg-white/70 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center p-4">
            <div className="relative mx-auto mb-3 w-12 h-12">
              <div className="absolute inset-0 rounded-full border-2 border-blue-400/30 animate-ping" />
              <div className="absolute inset-1 rounded-full border-2 border-blue-500/50 animate-pulse" />
              <Wand2 className="absolute inset-0 m-auto h-5 w-5 text-blue-600 dark:text-blue-400 animate-pulse" />
            </div>
            <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
              AI가 문제를 감지하고 있습니다...
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              잠시만 기다려주세요
            </p>
          </div>
        </div>
      )}
      <div
        className="relative inline-block mx-auto"
        style={{ maxHeight, overflow: "auto", touchAction: "none" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <img
          ref={imageRef}
          src={imageUrl}
          alt={`Page ${page.pageNumber}`}
          className="max-w-full"
          style={{ maxHeight }}
          onLoad={handleImageLoad}
          draggable={false}
          crossOrigin="anonymous"
        />

        {(paidPage ? boxes : []).map((box) => {
          const bx = box.x * scale;
          const by = box.y * scale;
          const bw = box.w * scale;
          const bh = box.h * scale;
          const borderColor = box.checked ? "rgb(59,130,246)" : "rgb(59,130,246)";
          const bgColor = box.checked ? "rgba(59,130,246,0.08)" : "rgba(59,130,246,0.04)";

          const startResize = (dir: string, startX: number, startY: number) => {
            const origX = box.x, origY = box.y, origW = box.w, origH = box.h;
            const onMove = (cx: number, cy: number) => {
              const dx = (cx - startX) / scale;
              const dy = (cy - startY) / scale;
              let nx = origX, ny = origY, nw = origW, nh = origH;
              if (dir.includes("e")) nw = Math.max(30, origW + dx);
              if (dir.includes("w")) { nx = origX + dx; nw = Math.max(30, origW - dx); }
              if (dir.includes("s")) nh = Math.max(30, origH + dy);
              if (dir.includes("n")) { ny = origY + dy; nh = Math.max(30, origH - dy); }
              updateBox(box.id, { x: nx, y: ny, w: nw, h: nh });
            };
            const onMouseMove = (me: MouseEvent) => onMove(me.clientX, me.clientY);
            const onTouchMove = (te: TouchEvent) => { te.preventDefault(); onMove(te.touches[0].clientX, te.touches[0].clientY); };
            const onUp = () => {
              document.removeEventListener("mousemove", onMouseMove);
              document.removeEventListener("mouseup", onUp);
              document.removeEventListener("touchmove", onTouchMove);
              document.removeEventListener("touchend", onUp);
            };
            document.addEventListener("mousemove", onMouseMove);
            document.addEventListener("mouseup", onUp);
            document.addEventListener("touchmove", onTouchMove, { passive: false });
            document.addEventListener("touchend", onUp);
          };
          const makeResizeHandler = (dir: string) => (e: React.MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
            startResize(dir, e.clientX, e.clientY);
          };
          const makeTouchResizeHandler = (dir: string) => (e: React.TouchEvent) => {
            e.stopPropagation();
            e.preventDefault();
            const touch = e.touches[0];
            startResize(dir, touch.clientX, touch.clientY);
          };

          const handleSize = 14;
          const hs = handleSize / 2;
          const handleStyle = (cursor: string, left: number, top: number): React.CSSProperties => ({
            position: "absolute", width: handleSize, height: handleSize, borderRadius: "50%",
            background: "white", border: `2px solid ${borderColor}`, cursor,
            left: left - hs, top: top - hs, zIndex: 5,
            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
            touchAction: "none",
          });

          return (
            <div
              key={box.id}
              className="absolute"
              style={{ left: bx, top: by, width: bw, height: bh, border: `2px solid ${borderColor}`, background: bgColor }}
            >
              <div className="absolute top-0.5 left-0.5 flex items-center gap-0.5 box-control" style={{ zIndex: 10 }}>
                <div
                  className="cursor-pointer mr-0.5"
                  onClick={(e) => { e.stopPropagation(); toggleCheck(box.id); }}
                >
                  <Checkbox checked={box.checked} className="h-3.5 w-3.5" data-testid={`check-box-${box.id}`} />
                </div>
                <span className="box-control text-[8px] font-medium text-blue-700 dark:text-blue-300 bg-white/95 dark:bg-gray-800/95 rounded-l px-1 h-5 flex items-center border border-r-0 border-blue-400 select-none whitespace-nowrap leading-none">쪽</span>
                <input
                  className="box-control bg-white/95 dark:bg-gray-800/95 border-y border-blue-400 text-[10px] font-medium w-8 h-5 text-blue-700 dark:text-blue-300 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  defaultValue={page.pageNumber}
                  key={`pn-${page.id}-${page.pageNumber}`}
                  onBlur={(e) => {
                    const num = parseInt(e.target.value);
                    if (!isNaN(num) && num > 0 && onPageNumberChange) {
                      onPageNumberChange(page.id, num);
                    } else {
                      e.target.value = String(page.pageNumber ?? "");
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  type="text"
                  inputMode="numeric"
                  data-testid={`input-page-number-${page.id}-${box.id}`}
                />
                <span className="box-control text-[8px] font-medium text-blue-700 dark:text-blue-300 bg-white/95 dark:bg-gray-800/95 px-1 h-5 flex items-center border-y border-blue-400 select-none whitespace-nowrap leading-none">번</span>
                <input
                  className="box-control bg-white/95 dark:bg-gray-800/95 border border-l-0 border-blue-400 rounded-r text-[10px] font-medium w-8 h-5 text-blue-700 dark:text-blue-300 text-center"
                  defaultValue={box.problemNumber}
                  key={`prob-${box.id}-${box.problemNumber}`}
                  onBlur={(e) => {
                    const val = e.target.value.trim();
                    if (val && val !== box.problemNumber) {
                      updateBox(box.id, { problemNumber: val });
                    } else if (!val) {
                      e.target.value = box.problemNumber;
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  data-testid={`input-problem-number-${box.id}`}
                />
                <button
                  className="box-control bg-red-500 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center text-[9px] hover:bg-red-600 ml-0.5"
                  onClick={(e) => { e.stopPropagation(); removeBox(box.id); }}
                  data-testid={`button-remove-box-${box.id}`}
                >
                  ×
                </button>
              </div>

              <div className="box-control" style={handleStyle("nw-resize", 0, 0)} onMouseDown={makeResizeHandler("nw")} onTouchStart={makeTouchResizeHandler("nw")} />
              <div className="box-control" style={handleStyle("n-resize", bw / 2, 0)} onMouseDown={makeResizeHandler("n")} onTouchStart={makeTouchResizeHandler("n")} />
              <div className="box-control" style={handleStyle("ne-resize", bw, 0)} onMouseDown={makeResizeHandler("ne")} onTouchStart={makeTouchResizeHandler("ne")} />
              <div className="box-control" style={handleStyle("w-resize", 0, bh / 2)} onMouseDown={makeResizeHandler("w")} onTouchStart={makeTouchResizeHandler("w")} />
              <div className="box-control" style={handleStyle("e-resize", bw, bh / 2)} onMouseDown={makeResizeHandler("e")} onTouchStart={makeTouchResizeHandler("e")} />
              <div className="box-control" style={handleStyle("sw-resize", 0, bh)} onMouseDown={makeResizeHandler("sw")} onTouchStart={makeTouchResizeHandler("sw")} />
              <div className="box-control" style={handleStyle("s-resize", bw / 2, bh)} onMouseDown={makeResizeHandler("s")} onTouchStart={makeTouchResizeHandler("s")} />
              <div className="box-control" style={handleStyle("se-resize", bw, bh)} onMouseDown={makeResizeHandler("se")} onTouchStart={makeTouchResizeHandler("se")} />
            </div>
          );
        })}

        {dragBox && (
          <div
            className="absolute border-2 border-dashed border-blue-400 bg-blue-400/10"
            style={{
              left: dragBox.x * scale,
              top: dragBox.y * scale,
              width: dragBox.w * scale,
              height: dragBox.h * scale,
            }}
          />
        )}
      </div>
    </div>
  );
}

function WorkbookEditor({
  workbook,
  onBack,
}: {
  workbook: WorkbookItem;
  onBack: () => void;
}) {
  const { user, selectedCenter } = useAuth();
  const [, setLocation] = useLocation();
  const centerId = selectedCenter?.id;
  const { toast } = useToast();
  const [pageBoxes, setPageBoxes] = useState<Record<string, Box[]>>({});
  const [wrongNoteTitle, setWrongNoteTitle] = useState("");
  const [showWrongNoteDialog, setShowWrongNoteDialog] = useState(false);
  const [autoDetecting, setAutoDetecting] = useState(false);
  const [showDetectConfirm, setShowDetectConfirm] = useState(false);
  const [detectConfirmInfo, setDetectConfirmInfo] = useState<{ pageCount: number; cost: number; balance: number; pageIds: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoDetectStartRef = useRef<number>(0);
  const [detectTargetPageIds, setDetectTargetPageIds] = useState<string[]>([]);
  const prevWorkbookIdRef = useRef<string>(workbook.id);

  useEffect(() => {
    if (prevWorkbookIdRef.current !== workbook.id) {
      setPageBoxes({});
      prevWorkbookIdRef.current = workbook.id;
    }
  }, [workbook.id]);

  const { data: pages = [], isLoading: pagesLoading } = useQuery<PageData[]>({
    queryKey: ["/api/math-workbooks", workbook.id, "pages"],
    queryFn: () => fetch(`/api/math-workbooks/${workbook.id}/pages?actorId=${user?.id}`).then(r => r.json()),
    enabled: !!user,
    refetchInterval: autoDetecting ? 1500 : false,
  });

  useEffect(() => {
    if (autoDetecting || pagesLoading || pages.length === 0) return;
    const pendingPages = pages.filter(p => p.detectionStatus === "pending");
    if (pendingPages.length > 0) {
      autoDetectStartRef.current = Date.now();
      setDetectTargetPageIds(pendingPages.map(p => p.id));
      setAutoDetecting(true);
    }
  }, [pagesLoading, pages.length > 0 && !autoDetecting]);

  const { data: creditInfo, isError: creditError } = useQuery<{ balance: number; costPerPage: number }>({
    queryKey: ["/api/math-credit-balance", centerId],
    queryFn: async () => {
      const r = await fetch(`/api/math-credit-balance?centerId=${centerId}&actorId=${user?.id}`);
      if (!r.ok) {
        const smsRes = await fetch(`/api/sms-credits/${centerId}?actorId=${user?.id}`);
        if (smsRes.ok) {
          const smsData = await smsRes.json();
          return { balance: smsData.balance || 0, costPerPage: COST_PER_PAGE };
        }
        throw new Error("잔액 조회 실패");
      }
      return r.json();
    },
    enabled: !!centerId && !!user,
  });

  useEffect(() => {
    if (!Array.isArray(pages) || pages.length === 0) return;

    setPageBoxes(prev => {
      const merged = { ...prev };
      let changed = false;

      for (const page of pages) {
        if (page.detectionStatus !== "completed") continue;
        if (merged[page.id] && merged[page.id].length > 0) continue;
        const problems = page.problems;
        if (!Array.isArray(problems) || problems.length === 0) continue;
        changed = true;
        merged[page.id] = problems.map((p) => ({
          id: p.id,
          x: p.cropX, y: p.cropY, w: p.cropWidth, h: p.cropHeight,
          problemNumber: p.problemNumber,
          checked: false,
          existingProblemId: p.id,
        }));
      }

      return changed ? merged : prev;
    });
  }, [pages]);

  // AI 감지 완료 체크
  useEffect(() => {
    if (!autoDetecting || detectTargetPageIds.length === 0 || !Array.isArray(pages)) return;
    const targetPages = pages.filter(p => detectTargetPageIds.includes(p.id));
    const allDone = targetPages.length > 0 && targetPages.every(p =>
      p.detectionStatus === "completed" || p.detectionStatus === "failed"
    );
    const timeoutMs = Math.max(120000, detectTargetPageIds.length * 8000);
    const timedOut = Date.now() - autoDetectStartRef.current > timeoutMs;

    if (allDone || timedOut) {
      setAutoDetecting(false);
      setDetectTargetPageIds([]);
      if (timedOut) {
        toast({ title: "시간 초과", description: "AI 감지가 시간 초과되었습니다. 멈춘 페이지를 초기화합니다." });
        apiRequest("POST", `/api/math-workbooks/${workbook.id}/reset-pending`, { actorId: user?.id })
          .then(() => queryClient.invalidateQueries({ queryKey: ["/api/math-workbooks", workbook.id, "pages"] }))
          .catch(() => {});
      } else {
        const failed = targetPages.filter(p => p.detectionStatus === "failed").length;
        if (failed > 0) {
          toast({ title: "AI 감지 완료", description: `${targetPages.length - failed}페이지 감지 완료, ${failed}페이지 실패` });
        } else {
          toast({ title: "AI 감지 완료", description: "모든 페이지의 문제가 자동 감지되었습니다." });
        }
      }
    }
  }, [pages, autoDetecting, detectTargetPageIds]);

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileArr = Array.from(files);
    uploadMutation.mutate({ files: fileArr });
  };

  const uploadMutation = useMutation({
    mutationFn: async ({ files }: { files: File[] }) => {
      const formData = new FormData();
      files.forEach(f => formData.append("files", f));
      formData.append("actorId", user!.id);
      formData.append("centerId", centerId!);
      const res = await fetch(`/api/math-workbooks/${workbook.id}/upload`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "업로드에 실패했습니다.");
      }
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/math-workbooks", workbook.id, "pages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/math-workbooks"] });
      const pageIds = (data.pages || []).map((p: any) => p.id);
      setDetectConfirmInfo({
        pageCount: data.newPageCount || pageIds.length,
        cost: data.detectionCost || pageIds.length * COST_PER_PAGE,
        balance: data.balance ?? 0,
        pageIds,
      });
      setShowDetectConfirm(true);
    },
    onError: (e: any) => {
      const msg = e.message || "서버 오류가 발생했습니다.";
      if (msg.includes("잔액") || msg.includes("충전") || msg.includes("부족")) {
        toast({ title: "충전 잔액 부족", description: msg, variant: "destructive" });
        if (confirm("충전금액이 부족합니다. 충전 페이지로 이동하시겠습니까?")) {
          setLocation("/sms-credit-charge");
          return;
        }
      } else {
        toast({ title: "업로드 실패", description: msg, variant: "destructive" });
      }
    },
  });

  const [detectingAll, setDetectingAll] = useState(false);

  const confirmDetectMutation = useMutation({
    mutationFn: async (pageIds: string[]) => {
      const res = await apiRequest("POST", `/api/math-workbooks/${workbook.id}/confirm-detect`, {
        actorId: user!.id,
        centerId,
        pageIds,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setShowDetectConfirm(false);
      setDetectConfirmInfo(null);
      queryClient.invalidateQueries({ queryKey: ["/api/math-workbooks", workbook.id, "pages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/math-credit-balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/math-workbooks"] });
      toast({ title: "AI 감지 시작", description: `${data.pageCount || 0}페이지 감지를 시작합니다. (${(data.charged || 0).toLocaleString()}원 차감)` });
      if (data.pageIds?.length > 0) {
        autoDetectStartRef.current = Date.now();
        setDetectTargetPageIds(data.pageIds);
        setAutoDetecting(true);
      }
    },
    onError: (e: any) => {
      const msg = e.message || "처리 중 오류가 발생했습니다.";
      if (msg.includes("잔액") || msg.includes("부족")) {
        toast({ title: "충전 잔액 부족", description: msg, variant: "destructive" });
        if (confirm("충전금액이 부족합니다. 충전 페이지로 이동하시겠습니까?")) {
          setShowDetectConfirm(false);
          setLocation("/sms-credit-charge");
        }
      } else {
        toast({ title: "AI 감지 실패", description: msg, variant: "destructive" });
      }
    },
  });

  const detectMutation = useMutation({
    mutationFn: async (pageId: string) => {
      const res = await apiRequest("POST", `/api/math-workbook-pages/${pageId}/detect`, {
        actorId: user!.id,
        centerId,
      });
      return res.json();
    },
    onSuccess: (data, pageId) => {
      if (data.boxes && Array.isArray(data.boxes)) {
        const newBoxes: Box[] = data.boxes.map((b: any, idx: number) => ({
          id: `ai-${Date.now()}-${idx}`,
          x: b.x, y: b.y, w: b.w, h: b.h,
          problemNumber: b.problemNumber || String(idx + 1),
          checked: false,
        }));
        setPageBoxes(prev => ({ ...prev, [pageId]: newBoxes }));
        saveBoxesMutation.mutate({ pageId, boxes: newBoxes });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/math-workbooks", workbook.id, "pages"] });
    },
    onError: (e: any) => {
      toast({ title: "AI 감지 실패", description: e.message, variant: "destructive" });
    },
  });

  const handleDetectAll = async () => {
    if (!pages.length) return;
    const undetectedPages = pages.filter(pg => pg.detectionStatus !== "completed" && pg.detectionStatus !== "pending");
    if (undetectedPages.length === 0) {
      toast({ title: "모든 페이지가 이미 감지 완료되었습니다" });
      return;
    }
    const totalCost = undetectedPages.length * COST_PER_PAGE;
    const currentBalance = creditInfo?.balance ?? 0;
    if (creditInfo && currentBalance < totalCost) {
      if (confirm(`잔액이 부족합니다. 필요: ${totalCost.toLocaleString()}원, 잔액: ${currentBalance.toLocaleString()}원\n충전하시겠습니까?`)) {
        setLocation("/sms-credit-charge");
      }
      return;
    }
    if (!confirm(`${undetectedPages.length}페이지를 AI 감지합니다.\n비용: ${totalCost.toLocaleString()}원 (${undetectedPages.length}페이지 × ${COST_PER_PAGE}원)\n진행하시겠습니까?`)) return;

    setDetectingAll(true);
    try {
      await confirmDetectMutation.mutateAsync(undetectedPages.map(pg => pg.id));
    } finally {
      setDetectingAll(false);
    }
  };

  const saveBoxesMutation = useMutation({
    mutationFn: async ({ pageId, boxes }: { pageId: string; boxes: Box[] }) => {
      const res = await apiRequest("POST", `/api/math-workbook-pages/${pageId}/save-boxes`, {
        actorId: user!.id,
        boxes: boxes.map(b => ({
          problemNumber: b.problemNumber,
          x: b.x, y: b.y, w: b.w, h: b.h,
          existingProblemId: b.existingProblemId,
        })),
      });
      return res.json();
    },
    onSuccess: (data, vars) => {
      if (data.problems) {
        setPageBoxes(prev => ({
          ...prev,
          [vars.pageId]: data.problems.map((p: any) => ({
            id: p.id,
            x: p.cropX, y: p.cropY, w: p.cropWidth, h: p.cropHeight,
            problemNumber: p.problemNumber,
            checked: prev[vars.pageId]?.find(b => b.existingProblemId === p.id)?.checked || false,
            existingProblemId: p.id,
          })),
        }));
      }
    },
  });

  const updatePageNumberMutation = useMutation({
    mutationFn: async ({ pageId, pageNumber }: { pageId: string; pageNumber: number }) => {
      const res = await apiRequest("PATCH", `/api/math-workbook-pages/${pageId}/page-number`, {
        actorId: user!.id,
        pageNumber,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/math-workbooks", workbook?.id, "pages"] });
    },
  });

  const handlePageNumberChange = useCallback((pageId: string, newPageNumber: number) => {
    updatePageNumberMutation.mutate({ pageId, pageNumber: newPageNumber });
  }, [updatePageNumberMutation]);

  const createWrongNoteMutation = useMutation({
    mutationFn: async () => {
      const selectedIds: string[] = [];
      for (const boxes of Object.values(pageBoxes)) {
        for (const box of boxes) {
          if (box.checked && box.existingProblemId) {
            selectedIds.push(box.existingProblemId);
          }
        }
      }
      if (selectedIds.length === 0) throw new Error("선택된 문제가 없습니다.");
      const res = await apiRequest("POST", "/api/math-wrong-notes", {
        centerId,
        workbookId: workbook.id,
        title: wrongNoteTitle || `오답노트 ${new Date().toLocaleDateString("ko-KR")}`,
        actorId: user!.id,
        problemIds: selectedIds,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "오답노트가 생성되었습니다." });
      setShowWrongNoteDialog(false);
      setWrongNoteTitle("");
      setPageBoxes(prev => {
        const updated = { ...prev };
        for (const key of Object.keys(updated)) {
          updated[key] = updated[key].map(b => ({ ...b, checked: false }));
        }
        return updated;
      });
      queryClient.invalidateQueries({ queryKey: ["/api/math-wrong-notes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/math-workbooks"] });
    },
    onError: (e: any) => {
      toast({ title: "생성 실패", description: e.message, variant: "destructive" });
    },
  });

  const autoSaveTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pendingBoxesRef = useRef<Record<string, Box[]>>({});
  const saveBoxesRef = useRef(saveBoxesMutation);
  saveBoxesRef.current = saveBoxesMutation;

  const handleBoxChange = useCallback((pageId: string, boxes: Box[]) => {
    setPageBoxes(prev => ({ ...prev, [pageId]: boxes }));
    pendingBoxesRef.current[pageId] = boxes;

    if (autoSaveTimerRef.current[pageId]) {
      clearTimeout(autoSaveTimerRef.current[pageId]);
    }
    autoSaveTimerRef.current[pageId] = setTimeout(() => {
      delete pendingBoxesRef.current[pageId];
      saveBoxesRef.current.mutate({
        pageId,
        boxes: boxes.map(b => ({
          ...b,
          problemNumber: b.problemNumber,
          x: b.x, y: b.y, w: b.w, h: b.h,
          existingProblemId: b.existingProblemId,
        })),
      });
    }, 800);
  }, []);

  useEffect(() => {
    return () => {
      Object.keys(autoSaveTimerRef.current).forEach(pageId => {
        clearTimeout(autoSaveTimerRef.current[pageId]);
      });
      const pending = pendingBoxesRef.current;
      Object.entries(pending).forEach(([pageId, boxes]) => {
        saveBoxesRef.current.mutate({
          pageId,
          boxes: boxes.map(b => ({
            ...b,
            problemNumber: b.problemNumber,
            x: b.x, y: b.y, w: b.w, h: b.h,
            existingProblemId: b.existingProblemId,
          })),
        });
      });
      pendingBoxesRef.current = {};
    };
  }, []);

  const handleSaveAllPages = () => {
    let saved = 0;
    for (const pg of pages) {
      const boxes = pageBoxes[pg.id] || [];
      saveBoxesMutation.mutate({ pageId: pg.id, boxes });
      saved++;
    }
    if (saved > 0) {
      toast({ title: `${saved}페이지의 박스가 저장되었습니다.` });
    }
  };

  const checkedCount = useMemo(() => {
    let count = 0;
    for (const boxes of Object.values(pageBoxes)) {
      count += boxes.filter(b => b.checked).length;
    }
    return count;
  }, [pageBoxes]);

  const balance = creditInfo?.balance || 0;
  if (pagesLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-1" /> 목록
          </Button>
          <Badge variant="outline" data-testid="text-balance">잔액: {balance.toLocaleString()}원</Badge>
          <Badge variant="secondary">{pages.length}페이지</Badge>
        </div>
        <h2 className="text-lg font-bold px-1 break-words" data-testid="text-workbook-title">{workbook.title}</h2>
      </div>

      <div className="flex gap-2 flex-wrap">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          multiple
          className="hidden"
          onChange={(e) => { handleFileSelect(e.target.files); e.target.value = ""; }}
          data-testid="input-file-upload"
        />
        <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadMutation.isPending} data-testid="button-upload">
          {uploadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
          파일 업로드
        </Button>
        {pages.length > 0 && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDetectAll}
              disabled={detectingAll || detectMutation.isPending || pages.length === 0}
              data-testid="button-ai-detect"
            >
              {(detectingAll || detectMutation.isPending) ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Wand2 className="h-4 w-4 mr-1" />}
              AI 문제 감지 (1p × {COST_PER_PAGE}원)
            </Button>
            {autoDetecting && (
              <div className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>자동 감지 중...</span>
              </div>
            )}
          </>
        )}
      </div>

      {pages.length > 0 && (
        <div
          className="snap-y snap-mandatory overflow-y-auto rounded-lg border"
          style={{ height: "calc(100vh - 260px)" }}
          data-testid="page-scroll-container"
        >
          {pages.map((page, idx) => (
            <div
              key={page.id}
              className="snap-start flex flex-col items-center justify-center"
              style={{ height: "calc(100vh - 260px)" }}
              data-testid={`page-editor-${idx}`}
            >
              <div className="text-xs text-muted-foreground mb-1 text-center font-medium">
                {page.detectionStatus === "completed" && page.pageNumber ? (
                  <>{page.pageNumber}p ({idx + 1}/{pages.length})</>
                ) : (
                  <>{idx + 1}/{pages.length}</>
                )}
              </div>
              <PageBoxEditor
                page={page}
                boxes={pageBoxes[page.id] || []}
                onChange={(boxes) => handleBoxChange(page.id, boxes)}
                paidPage={true}
                detecting={page?.detectionStatus === "pending"}
                maxHeight={`calc(100vh - 300px)`}
                onPageNumberChange={handlePageNumberChange}
              />
            </div>
          ))}
        </div>
      )}

      {pages.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <Upload className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>PDF 또는 이미지 파일을 업로드해주세요.</p>
          </CardContent>
        </Card>
      )}

      {checkedCount > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-primary text-primary-foreground rounded-lg shadow-lg px-4 py-3 flex items-center gap-3">
          <span className="text-sm font-medium">{checkedCount}개 문제 선택됨</span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowWrongNoteDialog(true)}
            data-testid="button-create-wrong-note"
          >
            오답노트 만들기
          </Button>
        </div>
      )}

      <Dialog open={showWrongNoteDialog} onOpenChange={setShowWrongNoteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>오답노트 만들기</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">오답노트 이름</label>
              <Input
                value={wrongNoteTitle}
                onChange={(e) => setWrongNoteTitle(e.target.value)}
                placeholder="예: 이차함수 오답 모음"
                data-testid="input-wrong-note-title"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              선택된 {checkedCount}개 문제로 오답노트를 생성합니다.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWrongNoteDialog(false)}>취소</Button>
            <Button
              onClick={() => createWrongNoteMutation.mutate()}
              disabled={createWrongNoteMutation.isPending}
              data-testid="button-confirm-wrong-note"
            >
              {createWrongNoteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              생성
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDetectConfirm} onOpenChange={(open) => { if (!open && !confirmDetectMutation.isPending) { setShowDetectConfirm(false); setDetectConfirmInfo(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>AI 문제 감지 확인</DialogTitle>
          </DialogHeader>
          {detectConfirmInfo && (
            <div className="space-y-3">
              <div className="bg-muted rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>감지 페이지 수</span>
                  <span className="font-medium">{detectConfirmInfo.pageCount}페이지</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>페이지당 비용</span>
                  <span className="font-medium">{COST_PER_PAGE.toLocaleString()}원</span>
                </div>
                <div className="border-t pt-2 flex justify-between text-sm font-semibold">
                  <span>차감 금액</span>
                  <span className="text-red-500">-{detectConfirmInfo.cost.toLocaleString()}원</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>현재 잔액</span>
                  <span>{detectConfirmInfo.balance.toLocaleString()}원</span>
                </div>
                {detectConfirmInfo.balance >= detectConfirmInfo.cost && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>차감 후 잔액</span>
                    <span>{(detectConfirmInfo.balance - detectConfirmInfo.cost).toLocaleString()}원</span>
                  </div>
                )}
              </div>
              {detectConfirmInfo.balance < detectConfirmInfo.cost && (
                <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950 rounded-lg p-3">
                  잔액이 부족합니다. 충전 후 다시 시도해주세요.
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowDetectConfirm(false); setDetectConfirmInfo(null); }} disabled={confirmDetectMutation.isPending} data-testid="button-cancel-detect">
              취소 (이미지만 저장)
            </Button>
            <Button
              onClick={() => detectConfirmInfo && confirmDetectMutation.mutate(detectConfirmInfo.pageIds)}
              disabled={confirmDetectMutation.isPending || !detectConfirmInfo || detectConfirmInfo.balance < detectConfirmInfo.cost}
              data-testid="button-confirm-detect"
            >
              {confirmDetectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              확인 및 감지 시작
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

function WrongNoteDetail({
  noteId,
  onBack,
}: {
  noteId: string;
  onBack: () => void;
}) {
  const { user, selectedCenter } = useAuth();
  const centerId = selectedCenter?.id;
  const { toast } = useToast();
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [filterMode, setFilterMode] = useState<"class" | "grade">("class");
  const [rerviewMode, setRerviewMode] = useState(false);
  const [excludedProblemIds, setExcludedProblemIds] = useState<Set<string>>(new Set());
  const [printColumns, setPrintColumns] = useState<1 | 2>(2);
  const [showRerviewDialog, setShowRerviewDialog] = useState(false);
  const [rerviewTitle, setRerviewTitle] = useState("");

  const isAdmin = user && user.role >= UserRole.PRINCIPAL;

  const detailSolveCountMutation = useMutation({
    mutationFn: async ({ solveCount }: { solveCount: number }) => {
      const res = await apiRequest("PATCH", `/api/math-wrong-notes/${noteId}/solve-count`, {
        actorId: user!.id,
        solveCount,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/math-wrong-notes", noteId] });
      queryClient.invalidateQueries({ queryKey: ["/api/math-wrong-notes/student", user!.id] });
    },
  });

  const { data: note, isLoading } = useQuery<any>({
    queryKey: ["/api/math-wrong-notes", noteId],
    queryFn: () => fetch(`/api/math-wrong-notes/${noteId}?actorId=${user?.id}`).then(r => r.json()),
    enabled: !!user,
  });

  const { data: allUsers = [] } = useQuery<any[]>({
    queryKey: ["/api/users", centerId],
    queryFn: () => fetch(`/api/users?centerId=${centerId}&actorId=${user?.id}`).then(r => r.json()),
    enabled: showAssignDialog && !!centerId,
  });

  const { data: allClasses = [] } = useQuery<any[]>({
    queryKey: ["/api/classes", centerId, selectedTeacherId],
    queryFn: () => {
      let url = `/api/classes?centerId=${centerId}`;
      if (selectedTeacherId) url += `&teacherId=${selectedTeacherId}`;
      else if (!isAdmin && user) url += `&teacherId=${user.id}`;
      return fetch(url).then(r => r.json());
    },
    enabled: showAssignDialog && !!centerId,
  });

  const { data: classStudentIds = [] } = useQuery<string[]>({
    queryKey: ["/api/classes", selectedClassId, "students"],
    queryFn: async () => {
      const res = await fetch(`/api/classes/${selectedClassId}/students`);
      const data = await res.json();
      return Array.isArray(data) ? data.map((s: any) => s.id || s.studentId) : [];
    },
    enabled: !!selectedClassId,
  });

  const teachers = useMemo(() => {
    return allUsers.filter((u: any) => u.role === UserRole.TEACHER || u.role === UserRole.PRINCIPAL || u.role === UserRole.ADMIN);
  }, [allUsers]);

  const students = useMemo(() => {
    return allUsers.filter((u: any) => u.role === UserRole.STUDENT);
  }, [allUsers]);

  const filteredStudents = useMemo(() => {
    let filtered = students;
    if (selectedClassId && classStudentIds.length > 0) {
      filtered = filtered.filter((s: any) => classStudentIds.includes(s.id));
    }
    if (selectedGrade) {
      filtered = filtered.filter((s: any) => s.grade === selectedGrade);
    }
    if (searchTerm) {
      filtered = filtered.filter((s: any) => s.name?.includes(searchTerm));
    }
    return filtered;
  }, [students, selectedGrade, selectedClassId, classStudentIds, searchTerm]);

  const shortenGrade = (grade: string) => {
    return grade
      .replace("중학교 ", "중").replace("중학교", "중")
      .replace("고등학교 ", "고").replace("고등학교", "고")
      .replace("초등학교 ", "초").replace("초등학교", "초")
      .replace("학년", "");
  };

  const grades = useMemo(() => {
    const gradeSet = new Set<string>();
    students.forEach((s: any) => { if (s.grade) gradeSet.add(s.grade); });
    const order = ["고3","고2","고1","중3","중2","중1","초6","초5","초4","초3","초2","초1"];
    return Array.from(gradeSet).sort((a, b) => {
      const sa = shortenGrade(a);
      const sb = shortenGrade(b);
      const ia = order.indexOf(sa);
      const ib = order.indexOf(sb);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [students]);

  useEffect(() => {
    if (note?.students) {
      setSelectedStudents(note.students.map((s: any) => s.studentId));
    }
  }, [note]);

  const assignMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/math-wrong-notes/${noteId}/assign-students`, {
        actorId: user!.id,
        studentIds: selectedStudents,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "학생이 할당되었습니다." });
      setShowAssignDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/math-wrong-notes", noteId] });
    },
  });

  const remainingItems = useMemo(() => {
    if (!note?.items) return [];
    return note.items.filter((item: any) => item.problem && !excludedProblemIds.has(item.problem.id));
  }, [note?.items, excludedProblemIds]);

  const toggleExclude = (problemId: string) => {
    setExcludedProblemIds(prev => {
      const next = new Set(prev);
      if (next.has(problemId)) next.delete(problemId);
      else next.add(problemId);
      return next;
    });
  };

  const createRerviewNoteMutation = useMutation({
    mutationFn: async () => {
      const problemIds = remainingItems.map((item: any) => item.problem.id);
      if (problemIds.length === 0) throw new Error("남은 문제가 없습니다.");
      const res = await apiRequest("POST", "/api/math-wrong-notes", {
        centerId,
        workbookId: note.workbookId,
        title: rerviewTitle || `${note.title} - 재오답`,
        actorId: user!.id,
        problemIds,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "오답노트의 오답노트가 생성되었습니다." });
      setShowRerviewDialog(false);
      setRerviewTitle("");
      setRerviewMode(false);
      setExcludedProblemIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/math-wrong-notes"] });
    },
    onError: (e: any) => {
      toast({ title: "생성 실패", description: e.message, variant: "destructive" });
    },
  });

  const handlePrint = async () => {
    if (!note) return;

    const esc = (s: string) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

    const sortedItems = [...(note.items || [])]
      .filter((item: any) => item.problem)
      .sort((a: any, b: any) => {
        const pageA = a.problem.page?.pageNumber ?? 0;
        const pageB = b.problem.page?.pageNumber ?? 0;
        if (pageA !== pageB) return pageA - pageB;
        const numA = parseInt(a.problem.problemNumber) || 0;
        const numB = parseInt(b.problem.problemNumber) || 0;
        return numA - numB;
      });

    const loadImage = (url: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("load failed"));
      img.src = url;
    });

    const pageImageCache = new Map<string, HTMLImageElement>();

    const cropToDataUrl = async (p: any): Promise<string | null> => {
      try {
        if (p.page?.imageUrl && p.cropX != null) {
          const pageUrl = resolveImageUrl(p.page);
          let pageImg = pageImageCache.get(pageUrl);
          if (!pageImg) {
            pageImg = await loadImage(pageUrl);
            pageImageCache.set(pageUrl, pageImg);
          }
          const canvas = document.createElement("canvas");
          canvas.width = p.cropWidth;
          canvas.height = p.cropHeight;
          canvas.getContext("2d")!.drawImage(
            pageImg, p.cropX, p.cropY, p.cropWidth, p.cropHeight,
            0, 0, p.cropWidth, p.cropHeight
          );
          return canvas.toDataURL("image/jpeg", 0.85);
        }
      } catch {}
      return null;
    };

    const cards: string[] = [];
    for (const item of sortedItems) {
      const p = item.problem;
      const pageNum = p.page?.pageNumber ?? "?";
      const label = esc(`${pageNum}p-${p.problemNumber}번`);

      if (p.imageUrl) {
        const url = resolveImageUrl(p);
        cards.push(`<div class="card"><div class="card-header">${label}</div><img src="${esc(url)}" class="card-img" /></div>`);
      } else {
        const dataUrl = await cropToDataUrl(p);
        if (dataUrl) {
          cards.push(`<div class="card"><div class="card-header">${label}</div><img src="${dataUrl}" class="card-img" /></div>`);
        } else {
          cards.push(`<div class="card"><div class="card-header">${label}</div><div style="height:60px;background:#f5f5f5;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#999;font-size:11px;">이미지 없음</div></div>`);
        }
      }
    }

    const rows: string[] = [];
    for (let i = 0; i < cards.length; i += printColumns) {
      const pair = cards.slice(i, i + printColumns).join("");
      rows.push(`<div class="row">${pair}</div>`);
    }

    const htmlContent = `<!DOCTYPE html><html><head><title>${esc(note.title)}</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0;}
        body{font-family:'Noto Sans KR',sans-serif;padding:8mm 10mm;}
        @page{size:A4;margin:8mm 10mm;}
        h1{font-size:16px;border-bottom:2px solid #333;padding-bottom:4px;margin-bottom:2px;}
        .meta{color:#666;font-size:10px;margin-bottom:8px;}
        .row{display:flex;gap:8px;margin-bottom:8px;break-inside:avoid;page-break-inside:avoid;}
        .card{flex:1;min-width:0;overflow:hidden;}
        .card-header{font-size:20px;font-weight:700;color:#333;margin-bottom:4px;padding:2px 0;}
        .card-img{width:100%;border:1px solid #ddd;border-radius:4px;display:block;}
      </style></head>
      <body>
        <h1>${esc(note.title)}</h1>
        <div class="meta">작성자: ${esc(note.creatorName)} | ${new Date(note.createdAt).toLocaleDateString("ko-KR")}</div>
        ${rows.join("")}
      </body></html>`;

    // Prefer opening a new window for printing — mobile browsers (Samsung Internet,
    // mobile Chrome) often clip iframe-based print output to a single page when the
    // iframe has a fixed height. A standalone window prints the full document reliably.
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(htmlContent);
      printWindow.document.close();

      const imgs = printWindow.document.querySelectorAll("img");
      let loaded = 0;
      const triggerPrint = () => {
        setTimeout(() => {
          try {
            printWindow.focus();
            printWindow.print();
          } catch {}
        }, 300);
      };
      if (!imgs.length) {
        triggerPrint();
      } else {
        imgs.forEach((img) => {
          if ((img as HTMLImageElement).complete) {
            loaded++;
            if (loaded >= imgs.length) triggerPrint();
          } else {
            img.addEventListener("load", () => {
              loaded++;
              if (loaded >= imgs.length) triggerPrint();
            });
            img.addEventListener("error", () => {
              loaded++;
              if (loaded >= imgs.length) triggerPrint();
            });
          }
        });
      }
      return;
    }

    // Fallback: iframe with auto height so mobile prints all pages.
    const existingFrame = document.getElementById("print-iframe");
    if (existingFrame) existingFrame.remove();

    const iframe = document.createElement("iframe");
    iframe.id = "print-iframe";
    iframe.style.cssText = "position:fixed;top:-10000px;left:-10000px;width:210mm;height:auto;border:none;";
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) return;
    iframeDoc.open();
    iframeDoc.write(htmlContent);
    iframeDoc.close();

    const imgs = iframeDoc.querySelectorAll("img");
    let loaded = 0;
    const triggerPrint = () => {
      setTimeout(() => {
        try {
          const fullHeight = iframeDoc.documentElement?.scrollHeight || iframeDoc.body?.scrollHeight || 0;
          if (fullHeight > 0) {
            iframe.style.height = `${fullHeight}px`;
          }
        } catch {}
        setTimeout(() => {
          iframe.contentWindow?.print();
          setTimeout(() => iframe.remove(), 1000);
        }, 100);
      }, 300);
    };
    if (!imgs.length) {
      triggerPrint();
    } else {
      imgs.forEach((img) => {
        if (img.complete) {
          loaded++;
          if (loaded >= imgs.length) triggerPrint();
        } else {
          img.onload = img.onerror = () => {
            loaded++;
            if (loaded >= imgs.length) triggerPrint();
          };
        }
      });
    }
  };

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!note) return <div className="text-center py-10 text-muted-foreground">오답노트를 찾을 수 없습니다.</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-note">
          <ArrowLeft className="h-4 w-4 mr-1" /> 목록
        </Button>
        <h2 className="text-xl font-bold flex-1" data-testid="text-note-title">{note.title}</h2>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
        <span>작성자: {note.creatorName}</span>
        <span>•</span>
        <span>{new Date(note.createdAt).toLocaleDateString("ko-KR")}</span>
        <span>•</span>
        <span>{note.items?.length || 0}문제</span>
        {user && user.role < UserRole.TEACHER && (() => {
          const myAssignment = note.students?.find((s: any) => s.studentId === user.id);
          if (!myAssignment) return null;
          const currentCount = myAssignment.solveCount ?? 0;
          return (
            <>
              <span>•</span>
              <div className="flex items-center gap-1">
                <span className="font-medium">푼 횟수:</span>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-5 w-5"
                  disabled={detailSolveCountMutation.isPending || currentCount <= 0}
                  onClick={() => detailSolveCountMutation.mutate({ solveCount: Math.max(0, currentCount - 1) })}
                  data-testid="button-detail-solve-minus"
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="font-bold min-w-[20px] text-center" data-testid="text-detail-solve-count">
                  {currentCount}
                </span>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-5 w-5"
                  disabled={detailSolveCountMutation.isPending}
                  onClick={() => detailSolveCountMutation.mutate({ solveCount: currentCount + 1 })}
                  data-testid="button-detail-solve-plus"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </>
          );
        })()}
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <div className="flex items-center rounded-md border overflow-hidden" data-testid="toggle-print-columns">
          <button
            type="button"
            onClick={() => setPrintColumns(1)}
            className={`px-2.5 py-1 text-sm ${printColumns === 1 ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
            data-testid="button-columns-1"
          >
            1열
          </button>
          <button
            type="button"
            onClick={() => setPrintColumns(2)}
            className={`px-2.5 py-1 text-sm border-l ${printColumns === 2 ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
            data-testid="button-columns-2"
          >
            2열
          </button>
        </div>
        <Button size="sm" variant="outline" onClick={handlePrint} data-testid="button-print">
          <Printer className="h-4 w-4 mr-1" /> 인쇄
        </Button>
        <Button size="sm" variant="outline" onClick={handlePrint} data-testid="button-pdf">
          <Download className="h-4 w-4 mr-1" /> PDF 다운로드
        </Button>
        {user && user.role >= UserRole.TEACHER && (
          <Button size="sm" onClick={() => setShowAssignDialog(true)} data-testid="button-assign">
            <Users className="h-4 w-4 mr-1" /> 학생 할당
          </Button>
        )}
        <Button
          size="sm"
          variant={rerviewMode ? "destructive" : "outline"}
          onClick={() => {
            if (rerviewMode) {
              setRerviewMode(false);
              setExcludedProblemIds(new Set());
            } else {
              setRerviewMode(true);
            }
          }}
          data-testid="button-rereview-mode"
        >
          <BookOpen className="h-4 w-4 mr-1" />
          {rerviewMode ? "취소" : (user && user.role >= UserRole.TEACHER ? "오답노트의 오답노트" : "나만의 오답노트 만들기")}
        </Button>
      </div>

      {rerviewMode && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm">
                {user && user.role >= UserRole.TEACHER
                  ? "맞은 문제를 클릭하여 제외하세요. 남은 문제로 새 오답노트를 만듭니다."
                  : "틀린 문제를 남기고, 맞은 문제를 클릭하여 제외하세요. 남은 문제로 나만의 오답노트를 만들 수 있어요."}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  제외: {excludedProblemIds.size}문제 / 남은: {remainingItems.length}문제
                </span>
                <Button
                  size="sm"
                  disabled={remainingItems.length === 0}
                  onClick={() => {
                    const isStudentRole = user && user.role < UserRole.TEACHER;
                    setRerviewTitle(isStudentRole ? `${note.title} - 나의 오답` : `${note.title} - 재오답`);
                    setShowRerviewDialog(true);
                  }}
                  data-testid="button-create-rereview"
                >
                  {user && user.role >= UserRole.TEACHER ? "새 오답노트 만들기" : "나만의 오답노트 만들기"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {note.students && note.students.length > 0 && user && user.role >= UserRole.TEACHER && (
        <div className="space-y-1">
          <span className="text-sm font-medium">할당 학생:</span>
          <div className="flex flex-wrap gap-2">
            {note.students.map((s: any) => (
              <Badge key={s.id} variant="secondary" className="flex items-center gap-1 py-1" data-testid={`badge-student-${s.studentId}`}>
                {s.studentName}
                <span className="text-xs bg-primary/10 text-primary rounded px-1">{s.solveCount ?? 0}회</span>
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {note.items?.map((item: any) => {
          if (!item.problem) return null;
          const imgUrl = item.problem.imageUrl ? resolveImageUrl(item.problem) : "";
          const isExcluded = rerviewMode && excludedProblemIds.has(item.problem.id);

          return (
            <Card
              key={item.id}
              className={`${rerviewMode ? "cursor-pointer transition-all" : ""} ${isExcluded ? "opacity-40 border-destructive" : ""}`}
              onClick={rerviewMode ? () => toggleExclude(item.problem.id) : undefined}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  {rerviewMode && (
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center text-xs font-bold ${isExcluded ? "border-destructive bg-destructive text-destructive-foreground" : "border-primary bg-primary text-primary-foreground"}`}>
                      {isExcluded ? "✕" : "✓"}
                    </div>
                  )}
                  <p className="text-sm font-medium">{item.problem.page?.pageNumber ? `${item.problem.page.pageNumber}p-` : ""}{item.problem.problemNumber}번</p>
                  {rerviewMode && (
                    <span className={`text-xs ml-auto ${isExcluded ? "text-destructive" : "text-primary"}`}>
                      {isExcluded ? "제외됨" : "포함"}
                    </span>
                  )}
                </div>
                {item.problem.imageUrl ? (
                  <img src={imgUrl} alt={`문제 ${item.problem.problemNumber}`} className="w-full rounded border" crossOrigin="anonymous" />
                ) : (
                  <div className="h-20 bg-muted rounded flex items-center justify-center text-sm text-muted-foreground">
                    이미지 생성 중...
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={showAssignDialog} onOpenChange={(open) => {
        setShowAssignDialog(open);
        if (!open) { setSelectedTeacherId(null); setSelectedClassId(null); setSelectedGrade(null); setSearchTerm(""); }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>학생 할당</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={filterMode === "class" ? "default" : "outline"}
                onClick={() => { setFilterMode("class"); setSelectedGrade(null); }}
                data-testid="button-filter-class"
              >
                반으로 선택
              </Button>
              <Button
                size="sm"
                variant={filterMode === "grade" ? "default" : "outline"}
                onClick={() => { setFilterMode("grade"); setSelectedClassId(null); setSelectedTeacherId(null); }}
                data-testid="button-filter-grade"
              >
                학년으로 선택
              </Button>
            </div>
            {filterMode === "class" && (
              <>
                {isAdmin && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">선생님 선택</p>
                    <div className="flex gap-1 flex-wrap">
                      <Button
                        size="sm"
                        variant={selectedTeacherId === null ? "default" : "outline"}
                        onClick={() => { setSelectedTeacherId(null); setSelectedClassId(null); }}
                        data-testid="button-teacher-all"
                      >
                        전체
                      </Button>
                      {teachers.map((t: any) => (
                        <Button
                          key={t.id}
                          size="sm"
                          variant={selectedTeacherId === t.id ? "default" : "outline"}
                          onClick={() => { setSelectedTeacherId(t.id); setSelectedClassId(null); }}
                          data-testid={`button-teacher-${t.id}`}
                        >
                          {t.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
                {allClasses.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">반 선택</p>
                    <div className="flex gap-1 flex-wrap">
                      <Button
                        size="sm"
                        variant={selectedClassId === null ? "default" : "outline"}
                        onClick={() => setSelectedClassId(null)}
                        data-testid="button-class-all"
                      >
                        전체
                      </Button>
                      {allClasses.map((cls: any) => (
                        <Button
                          key={cls.id}
                          size="sm"
                          variant={selectedClassId === cls.id ? "default" : "outline"}
                          onClick={() => setSelectedClassId(cls.id)}
                          data-testid={`button-class-${cls.id}`}
                        >
                          {cls.name} {cls.subject}반
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
            {filterMode === "grade" && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">학년 필터</p>
                <div className="flex gap-1 flex-wrap">
                  <Button
                    size="sm"
                    variant={selectedGrade === null ? "default" : "outline"}
                    onClick={() => setSelectedGrade(null)}
                  >
                    전체
                  </Button>
                  {grades.map(g => (
                    <Button
                      key={g}
                      size="sm"
                      variant={selectedGrade === g ? "default" : "outline"}
                      onClick={() => setSelectedGrade(g)}
                      data-testid={`button-grade-${g}`}
                    >
                      {shortenGrade(g)}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="학생 이름 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="input-student-search"
              />
            </div>
            {filteredStudents.length > 0 && (
              <div
                className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer border-b"
                onClick={() => {
                  const allFilteredIds = filteredStudents.map((s: any) => s.id);
                  const allSelected = allFilteredIds.every((id: string) => selectedStudents.includes(id));
                  if (allSelected) {
                    setSelectedStudents(prev => prev.filter(id => !allFilteredIds.includes(id)));
                  } else {
                    setSelectedStudents(prev => [...new Set([...prev, ...allFilteredIds])]);
                  }
                }}
                data-testid="select-all-students"
              >
                <Checkbox checked={filteredStudents.length > 0 && filteredStudents.every((s: any) => selectedStudents.includes(s.id))} />
                <span className="text-sm font-medium">전체 선택 ({filteredStudents.length}명)</span>
              </div>
            )}
            <ScrollArea className="h-48">
              <div className="space-y-1">
                {filteredStudents.map((student: any) => (
                  <div
                    key={student.id}
                    className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                    onClick={() => {
                      setSelectedStudents(prev =>
                        prev.includes(student.id) ? prev.filter(id => id !== student.id) : [...prev, student.id]
                      );
                    }}
                    data-testid={`student-option-${student.id}`}
                  >
                    <Checkbox checked={selectedStudents.includes(student.id)} />
                    <span className="text-sm">{student.name}</span>
                    <Badge variant="outline" className="text-xs">{student.grade ? shortenGrade(student.grade) : "-"}</Badge>
                  </div>
                ))}
                {filteredStudents.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">학생이 없습니다.</p>
                )}
              </div>
            </ScrollArea>
            <p className="text-sm text-muted-foreground">{selectedStudents.length}명 선택됨</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignDialog(false)}>취소</Button>
            <Button
              onClick={() => assignMutation.mutate()}
              disabled={assignMutation.isPending}
              data-testid="button-confirm-assign"
            >
              {assignMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              할당
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRerviewDialog} onOpenChange={setShowRerviewDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>오답노트의 오답노트 만들기</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              제외한 {excludedProblemIds.size}문제를 빼고 남은 {remainingItems.length}문제로 새 오답노트를 생성합니다.
            </p>
            <Input
              placeholder="오답노트 제목"
              value={rerviewTitle}
              onChange={(e) => setRerviewTitle(e.target.value)}
              data-testid="input-rereview-title"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRerviewDialog(false)}>취소</Button>
            <Button
              onClick={() => createRerviewNoteMutation.mutate()}
              disabled={createRerviewNoteMutation.isPending || remainingItems.length === 0}
              data-testid="button-confirm-rereview"
            >
              {createRerviewNoteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              만들기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type FolderItem = { id: string; centerId: string; name: string; parentId: string | null; createdBy: string; createdAt: string };

export default function MathWrongNotesPage() {
  const { user, selectedCenter, isLoading: authLoading } = useAuth();
  const centerId = selectedCenter?.id;
  const { toast } = useToast();
  const [view, setView] = useState<"list" | "workbook" | "wrong-note">("list");
  const [selectedWorkbook, setSelectedWorkbook] = useState<WorkbookItem | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [tab, setTab] = useState<"workbooks" | "wrong-notes" | "student-notes">("workbooks");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<FolderItem[]>([]);
  const [showFolderDialog, setShowFolderDialog] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [editingFolder, setEditingFolder] = useState<FolderItem | null>(null);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [movingNoteId, setMovingNoteId] = useState<string | null>(null);
  const [showRenameNoteDialog, setShowRenameNoteDialog] = useState(false);
  const [renamingNoteId, setRenamingNoteId] = useState<string | null>(null);
  const [renameNoteTitle, setRenameNoteTitle] = useState("");

  const [studentNoteGrade, setStudentNoteGrade] = useState<string | null>(null);
  const [studentNoteSearch, setStudentNoteSearch] = useState("");
  const [selectedStudentForNotes, setSelectedStudentForNotes] = useState<string | null>(null);

  const [wbCurrentFolderId, setWbCurrentFolderId] = useState<string | null>(null);
  const [wbFolderPath, setWbFolderPath] = useState<FolderItem[]>([]);
  const [showWbFolderDialog, setShowWbFolderDialog] = useState(false);
  const [wbFolderName, setWbFolderName] = useState("");
  const [editingWbFolder, setEditingWbFolder] = useState<FolderItem | null>(null);
  const [showWbMoveDialog, setShowWbMoveDialog] = useState(false);
  const [movingWbId, setMovingWbId] = useState<string | null>(null);
  const [showRenameWbDialog, setShowRenameWbDialog] = useState(false);
  const [renamingWbId, setRenamingWbId] = useState<string | null>(null);
  const [renameWbTitle, setRenameWbTitle] = useState("");

  const isTeacher = user && user.role >= UserRole.TEACHER;
  const isStudent = user && (user.role === UserRole.STUDENT || user.role === UserRole.PARENT);

  const { data: workbooks = [], isLoading: workbooksLoading } = useQuery<WorkbookItem[]>({
    queryKey: ["/api/math-workbooks", centerId],
    queryFn: () => fetch(`/api/math-workbooks?centerId=${centerId}&actorId=${user?.id}`).then(r => r.json()),
    enabled: !!centerId && !!user && isTeacher === true,
  });

  const { data: wbFolders = [] } = useQuery<FolderItem[]>({
    queryKey: ["/api/math-workbook-folders", centerId],
    queryFn: () => fetch(`/api/math-workbook-folders?centerId=${centerId}&actorId=${user?.id}`).then(r => r.json()),
    enabled: !!centerId && !!user && isTeacher === true,
  });

  const wbCurrentFolders = useMemo(() => {
    return wbFolders.filter(f => f.parentId === wbCurrentFolderId).sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }, [wbFolders, wbCurrentFolderId]);

  const currentWorkbooks = useMemo(() => {
    return workbooks.filter(wb => (wb.folderId || null) === wbCurrentFolderId);
  }, [workbooks, wbCurrentFolderId]);

  const navigateToWbFolder = (folder: FolderItem | null) => {
    if (!folder) {
      setWbCurrentFolderId(null);
      setWbFolderPath([]);
    } else {
      setWbCurrentFolderId(folder.id);
      const idx = wbFolderPath.findIndex(f => f.id === folder.id);
      if (idx >= 0) {
        setWbFolderPath(wbFolderPath.slice(0, idx + 1));
      } else {
        setWbFolderPath([...wbFolderPath, folder]);
      }
    }
  };

  const { data: wrongNotes = [], isLoading: notesLoading } = useQuery<WrongNoteItem[]>({
    queryKey: ["/api/math-wrong-notes", centerId],
    queryFn: () => {
      if (isStudent) {
        return fetch(`/api/math-wrong-notes/student/${user!.id}?actorId=${user!.id}`).then(r => r.json());
      }
      return fetch(`/api/math-wrong-notes?centerId=${centerId}&actorId=${user?.id}`).then(r => r.json());
    },
    enabled: !!centerId && !!user,
  });

  const { data: studentCreatedData } = useQuery<{ notes: any[]; students: any[] }>({
    queryKey: ["/api/math-wrong-notes/student-created", centerId],
    queryFn: () => fetch(`/api/math-wrong-notes/student-created?centerId=${centerId}&actorId=${user?.id}`).then(r => r.json()),
    enabled: !!centerId && !!user && isTeacher && tab === "student-notes",
  });

  const studentNoteGrades = useMemo(() => {
    if (!studentCreatedData?.students) return [];
    const grades = [...new Set(studentCreatedData.students.map((s: any) => s.grade).filter(Boolean))];
    const order = ["초1","초2","초3","초4","초5","초6","중1","중2","중3","고1","고2","고3"];
    return grades.sort((a, b) => {
      const ai = order.indexOf(a); const bi = order.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, [studentCreatedData?.students]);

  const filteredStudents = useMemo(() => {
    if (!studentCreatedData?.students) return [];
    let list = studentCreatedData.students;
    if (studentNoteGrade) list = list.filter((s: any) => s.grade === studentNoteGrade);
    if (studentNoteSearch.trim()) {
      const q = studentNoteSearch.trim().toLowerCase();
      list = list.filter((s: any) => s.name.toLowerCase().includes(q));
    }
    return list;
  }, [studentCreatedData?.students, studentNoteGrade, studentNoteSearch]);

  const selectedStudentNotes = useMemo(() => {
    if (!studentCreatedData?.notes || !selectedStudentForNotes) return [];
    return studentCreatedData.notes.filter((n: any) => n.createdBy === selectedStudentForNotes);
  }, [studentCreatedData?.notes, selectedStudentForNotes]);

  const { data: folders = [] } = useQuery<FolderItem[]>({
    queryKey: ["/api/math-wrong-note-folders", centerId],
    queryFn: () => fetch(`/api/math-wrong-note-folders?centerId=${centerId}&actorId=${user?.id}`).then(r => r.json()),
    enabled: !!centerId && !!user,
  });

  const currentFolders = useMemo(() => {
    return folders.filter(f => f.parentId === currentFolderId).sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }, [folders, currentFolderId]);

  const currentNotes = useMemo(() => {
    if (isStudent) {
      return wrongNotes.filter(n => {
        const isMyNote = n.createdByRole === "student" && n.createdBy === user?.id;
        if (isMyNote) {
          return (n.folderId || null) === currentFolderId;
        }
        return currentFolderId === null;
      });
    }
    return wrongNotes.filter(n => (n.folderId || null) === currentFolderId);
  }, [wrongNotes, currentFolderId, isStudent, user?.id]);

  const navigateToFolder = (folder: FolderItem | null) => {
    if (!folder) {
      setCurrentFolderId(null);
      setFolderPath([]);
    } else {
      setCurrentFolderId(folder.id);
      const idx = folderPath.findIndex(f => f.id === folder.id);
      if (idx >= 0) {
        setFolderPath(folderPath.slice(0, idx + 1));
      } else {
        setFolderPath([...folderPath, folder]);
      }
    }
  };

  const createFolderMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/math-wrong-note-folders", {
        centerId, name: folderName, parentId: currentFolderId, actorId: user!.id,
      });
      return res.json();
    },
    onSuccess: () => {
      setShowFolderDialog(false);
      setFolderName("");
      setEditingFolder(null);
      queryClient.invalidateQueries({ queryKey: ["/api/math-wrong-note-folders"] });
    },
    onError: (e: any) => toast({ title: "폴더 생성 실패", description: e.message, variant: "destructive" }),
  });

  const updateFolderMutation = useMutation({
    mutationFn: async () => {
      if (!editingFolder) return;
      const res = await apiRequest("PATCH", `/api/math-wrong-note-folders/${editingFolder.id}`, {
        name: folderName, actorId: user!.id,
      });
      return res.json();
    },
    onSuccess: () => {
      setShowFolderDialog(false);
      setFolderName("");
      setEditingFolder(null);
      queryClient.invalidateQueries({ queryKey: ["/api/math-wrong-note-folders"] });
    },
    onError: (e: any) => toast({ title: "폴더 수정 실패", description: e.message, variant: "destructive" }),
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/math-wrong-note-folders/${id}?actorId=${user!.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/math-wrong-note-folders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/math-wrong-notes"] });
      toast({ title: "폴더가 삭제되었습니다." });
    },
  });

  const moveNoteMutation = useMutation({
    mutationFn: async ({ noteId, folderId }: { noteId: string; folderId: string | null }) => {
      const res = await apiRequest("PATCH", `/api/math-wrong-notes/${noteId}/folder`, {
        folderId, actorId: user!.id,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/math-wrong-notes"] });
      setShowMoveDialog(false);
      setMovingNoteId(null);
      toast({ title: "오답노트가 이동되었습니다." });
    },
    onError: (e: any) => toast({ title: "이동 실패", description: e.message, variant: "destructive" }),
  });

  const renameNoteMutation = useMutation({
    mutationFn: async () => {
      if (!renamingNoteId) return;
      const res = await apiRequest("PATCH", `/api/math-wrong-notes/${renamingNoteId}/title`, {
        title: renameNoteTitle, actorId: user!.id,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/math-wrong-notes"] });
      setShowRenameNoteDialog(false);
      setRenamingNoteId(null);
      setRenameNoteTitle("");
      toast({ title: "오답노트 이름이 변경되었습니다." });
    },
    onError: (e: any) => toast({ title: "이름 변경 실패", description: e.message, variant: "destructive" }),
  });

  const createWorkbookMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/math-workbooks", {
        centerId, title: newTitle, folderId: wbCurrentFolderId, actorId: user!.id,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setShowCreateDialog(false);
      setNewTitle("");
      queryClient.invalidateQueries({ queryKey: ["/api/math-workbooks"] });
      setSelectedWorkbook({ ...data, pageCount: 0, wrongNoteCount: 0, creatorName: user!.name || "" } as WorkbookItem);
      setView("workbook");
    },
    onError: (e: any) => {
      toast({ title: "생성 실패", description: e.message, variant: "destructive" });
    },
  });

  const deleteWorkbookMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/math-workbooks/${id}?actorId=${user!.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/math-workbooks"] });
      toast({ title: "문제집이 삭제되었습니다." });
    },
  });

  const createWbFolderMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/math-workbook-folders", {
        centerId, name: wbFolderName, parentId: wbCurrentFolderId, actorId: user!.id,
      });
      return res.json();
    },
    onSuccess: () => {
      setShowWbFolderDialog(false);
      setWbFolderName("");
      setEditingWbFolder(null);
      queryClient.invalidateQueries({ queryKey: ["/api/math-workbook-folders"] });
    },
    onError: (e: any) => toast({ title: "폴더 생성 실패", description: e.message, variant: "destructive" }),
  });

  const updateWbFolderMutation = useMutation({
    mutationFn: async () => {
      if (!editingWbFolder) return;
      const res = await apiRequest("PATCH", `/api/math-workbook-folders/${editingWbFolder.id}`, {
        name: wbFolderName, actorId: user!.id,
      });
      return res.json();
    },
    onSuccess: () => {
      setShowWbFolderDialog(false);
      setWbFolderName("");
      setEditingWbFolder(null);
      queryClient.invalidateQueries({ queryKey: ["/api/math-workbook-folders"] });
    },
    onError: (e: any) => toast({ title: "폴더 수정 실패", description: e.message, variant: "destructive" }),
  });

  const deleteWbFolderMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/math-workbook-folders/${id}?actorId=${user!.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/math-workbook-folders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/math-workbooks"] });
      toast({ title: "폴더가 삭제되었습니다." });
    },
  });

  const moveWbMutation = useMutation({
    mutationFn: async ({ wbId, folderId }: { wbId: string; folderId: string | null }) => {
      const res = await apiRequest("PATCH", `/api/math-workbooks/${wbId}/folder`, {
        folderId, actorId: user!.id,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/math-workbooks"] });
      setShowWbMoveDialog(false);
      setMovingWbId(null);
      toast({ title: "문제집이 이동되었습니다." });
    },
    onError: (e: any) => toast({ title: "이동 실패", description: e.message, variant: "destructive" }),
  });

  const renameWbMutation = useMutation({
    mutationFn: async () => {
      if (!renamingWbId) return;
      const res = await apiRequest("PATCH", `/api/math-workbooks/${renamingWbId}/title`, {
        title: renameWbTitle, actorId: user!.id,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/math-workbooks"] });
      setShowRenameWbDialog(false);
      setRenamingWbId(null);
      setRenameWbTitle("");
      toast({ title: "문제집 이름이 변경되었습니다." });
    },
    onError: (e: any) => toast({ title: "이름 변경 실패", description: e.message, variant: "destructive" }),
  });

  const updateSolveCountMutation = useMutation({
    mutationFn: async ({ noteId, solveCount }: { noteId: string; solveCount: number }) => {
      const res = await apiRequest("PATCH", `/api/math-wrong-notes/${noteId}/solve-count`, {
        actorId: user!.id,
        solveCount,
      });
      return res.json();
    },
    onSuccess: () => {
      if (isStudent) {
        queryClient.invalidateQueries({ queryKey: ["/api/math-wrong-notes/student", user!.id] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/math-wrong-notes"] });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/math-wrong-notes/${id}?actorId=${user!.id}`);
      return res.json();
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ["/api/math-wrong-notes", centerId] });
      const prev = queryClient.getQueryData<WrongNoteItem[]>(["/api/math-wrong-notes", centerId]);
      queryClient.setQueryData<WrongNoteItem[]>(["/api/math-wrong-notes", centerId], (old) =>
        old ? old.filter(n => n.id !== id) : []
      );
      return { prev };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/math-wrong-notes"] });
      toast({ title: "오답노트가 삭제되었습니다." });
    },
    onError: (_err: any, _id: string, context: any) => {
      if (context?.prev) {
        queryClient.setQueryData(["/api/math-wrong-notes", centerId], context.prev);
      }
      toast({ title: "삭제 실패", variant: "destructive" });
    },
  });

  if (authLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!user || !centerId) {
    return <div className="flex items-center justify-center min-h-[60vh]"><p className="text-muted-foreground">로그인이 필요합니다.</p></div>;
  }

  if (view === "workbook" && selectedWorkbook) {
    return (
      <div className="container max-w-4xl mx-auto py-4 px-4">
        <WorkbookEditor
          workbook={selectedWorkbook}
          onBack={() => { setView("list"); setSelectedWorkbook(null); }}
        />
      </div>
    );
  }

  if (view === "wrong-note" && selectedNoteId) {
    return (
      <div className="container max-w-4xl mx-auto py-4 px-4">
        <WrongNoteDetail
          noteId={selectedNoteId}
          onBack={() => { setView("list"); setSelectedNoteId(null); }}
        />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto py-4 px-4 space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold" data-testid="text-page-title">수학 오답노트</h1>
        <ManualButton menuKey="math-wrong-notes" />
      </div>

      {isTeacher && (
        <div className="flex gap-2 border-b">
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "workbooks" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            onClick={() => setTab("workbooks")}
            data-testid="tab-workbooks"
          >
            <BookOpen className="h-4 w-4 inline mr-1" /> 문제집
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "wrong-notes" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            onClick={() => setTab("wrong-notes")}
            data-testid="tab-wrong-notes"
          >
            <FileText className="h-4 w-4 inline mr-1" /> 오답노트
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "student-notes" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            onClick={() => { setTab("student-notes"); setSelectedStudentForNotes(null); }}
            data-testid="tab-student-notes"
          >
            <Users className="h-4 w-4 inline mr-1" /> 학생 제작 오답노트
          </button>
        </div>
      )}

      {isTeacher && tab === "workbooks" && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-sm flex-wrap">
              <button
                className="text-primary hover:underline font-medium"
                onClick={() => navigateToWbFolder(null)}
                data-testid="wb-breadcrumb-root"
              >
                전체
              </button>
              {wbFolderPath.map((f) => (
                <span key={f.id} className="flex items-center gap-1">
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  <button
                    className="text-primary hover:underline font-medium"
                    onClick={() => navigateToWbFolder(f)}
                    data-testid={`wb-breadcrumb-${f.id}`}
                  >
                    {f.name}
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setEditingWbFolder(null); setWbFolderName(""); setShowWbFolderDialog(true); }}
                data-testid="button-new-wb-folder"
              >
                <FolderPlus className="h-4 w-4 mr-1" /> 새 폴더
              </Button>
              <Button size="sm" onClick={() => setShowCreateDialog(true)} data-testid="button-new-workbook">
                <Plus className="h-4 w-4 mr-1" /> 문제집 등록
              </Button>
            </div>
          </div>

          {workbooksLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : (
            <div className="space-y-2">
              {wbCurrentFolders.map((folder) => (
                <Card key={folder.id} className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigateToWbFolder(folder)}
                  data-testid={`card-wb-folder-${folder.id}`}
                >
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Folder className="h-5 w-5 text-yellow-500" />
                      <div>
                        <h3 className="font-medium">{folder.name}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {workbooks.filter(w => w.folderId === folder.id).length}개 문제집
                          {wbFolders.filter(f => f.parentId === folder.id).length > 0 && ` • ${wbFolders.filter(f => f.parentId === folder.id).length}개 하위폴더`}
                        </p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="ghost" data-testid={`menu-wb-folder-${folder.id}`}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          setEditingWbFolder(folder);
                          setWbFolderName(folder.name);
                          setShowWbFolderDialog(true);
                        }}>
                          <Pencil className="h-4 w-4 mr-2" /> 이름 변경
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`"${folder.name}" 폴더를 삭제하시겠습니까?\n폴더 안의 문제집은 상위로 이동됩니다.`)) {
                            deleteWbFolderMutation.mutate(folder.id);
                          }
                        }}>
                          <Trash2 className="h-4 w-4 mr-2" /> 삭제
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardContent>
                </Card>
              ))}

              {currentWorkbooks.length === 0 && wbCurrentFolders.length === 0 ? (
                <Card><CardContent className="py-10 text-center text-muted-foreground">
                  {wbCurrentFolderId ? "이 폴더에 문제집이 없습니다." : "등록된 문제집이 없습니다."}
                </CardContent></Card>
              ) : (
                currentWorkbooks.map((wb) => (
                  <Card key={wb.id} className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => { setSelectedWorkbook(wb); setView("workbook"); }}
                    data-testid={`card-workbook-${wb.id}`}
                  >
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">{wb.title}</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          {wb.creatorName} • {wb.pageCount}페이지 • 오답노트 {wb.wrongNoteCount}개
                          {wb.createdAt && ` • ${new Date(wb.createdAt).toLocaleDateString("ko-KR")}`}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button size="sm" variant="ghost" data-testid={`menu-workbook-${wb.id}`}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            setRenamingWbId(wb.id);
                            setRenameWbTitle(wb.title);
                            setShowRenameWbDialog(true);
                          }}>
                            <Pencil className="h-4 w-4 mr-2" /> 이름 변경
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            setMovingWbId(wb.id);
                            setShowWbMoveDialog(true);
                          }}>
                            <MoveRight className="h-4 w-4 mr-2" /> 폴더 이동
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`"${wb.title}" 문제집을 삭제하시겠습니까?`)) {
                              deleteWorkbookMutation.mutate(wb.id);
                            }
                          }}>
                            <Trash2 className="h-4 w-4 mr-2" /> 삭제
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </>
      )}

      {(isStudent || (isTeacher && tab === "wrong-notes")) && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-sm flex-wrap">
              <button
                className="text-primary hover:underline font-medium"
                onClick={() => navigateToFolder(null)}
                data-testid="breadcrumb-root"
              >
                전체
              </button>
              {folderPath.map((f) => (
                <span key={f.id} className="flex items-center gap-1">
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  <button
                    className="text-primary hover:underline font-medium"
                    onClick={() => navigateToFolder(f)}
                    data-testid={`breadcrumb-${f.id}`}
                  >
                    {f.name}
                  </button>
                </span>
              ))}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setEditingFolder(null); setFolderName(""); setShowFolderDialog(true); }}
              data-testid="button-new-folder"
            >
              <FolderPlus className="h-4 w-4 mr-1" /> 새 폴더
            </Button>
          </div>

          {notesLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : (
            <div className="space-y-2">
              {currentFolders.map((folder) => (
                <Card key={folder.id} className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigateToFolder(folder)}
                  data-testid={`card-folder-${folder.id}`}
                >
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Folder className="h-5 w-5 text-yellow-500" />
                      <div>
                        <h3 className="font-medium">{folder.name}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {wrongNotes.filter(n => n.folderId === folder.id).length}개 오답노트
                          {folders.filter(f => f.parentId === folder.id).length > 0 && ` • ${folders.filter(f => f.parentId === folder.id).length}개 하위폴더`}
                        </p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="ghost" data-testid={`menu-folder-${folder.id}`}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          setEditingFolder(folder);
                          setFolderName(folder.name);
                          setShowFolderDialog(true);
                        }}>
                          <Pencil className="h-4 w-4 mr-2" /> 이름 변경
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`"${folder.name}" 폴더를 삭제하시겠습니까?\n폴더 안의 오답노트는 상위로 이동됩니다.`)) {
                            deleteFolderMutation.mutate(folder.id);
                          }
                        }}>
                          <Trash2 className="h-4 w-4 mr-2" /> 삭제
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardContent>
                </Card>
              ))}

              {currentNotes.length === 0 && currentFolders.length === 0 ? (
                <Card><CardContent className="py-10 text-center text-muted-foreground">
                  {isStudent ? "오답노트가 없습니다." : "이 폴더에 오답노트가 없습니다."}
                </CardContent></Card>
              ) : (
                currentNotes.map((note) => {
                  const isStudentCreated = note.createdByRole === "student";
                  const isMyNote = isStudent && note.createdBy === user?.id;
                  return (
                    <Card key={note.id} className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => { setSelectedNoteId(note.id); setView("wrong-note"); }}
                      data-testid={`card-note-${note.id}`}
                    >
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">{note.title}</h3>
                            {isStudentCreated && (
                              <Badge variant="outline" className="text-xs border-blue-400 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950" data-testid={`badge-student-created-${note.id}`}>
                                학생 작성
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {note.creatorName} • {note.itemCount}문제
                            {note.studentCount !== undefined && note.studentCount > 0 && ` • ${note.studentCount}명 할당`}
                            {note.assignerName && ` • 할당: ${note.assignerName}`}
                            {note.createdAt && ` • ${new Date(note.createdAt).toLocaleDateString("ko-KR")}`}
                          </p>
                          {isStudent && note.assignerName && (
                            <div className="flex items-center gap-1 mt-1.5" onClick={(e) => e.stopPropagation()}>
                              <span className="text-xs font-medium text-muted-foreground">푼 횟수:</span>
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-5 w-5"
                                disabled={updateSolveCountMutation.isPending || (note.solveCount ?? 0) <= 0}
                                onClick={() => updateSolveCountMutation.mutate({ noteId: note.id, solveCount: Math.max(0, (note.solveCount ?? 0) - 1) })}
                                data-testid={`button-solve-minus-${note.id}`}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="text-sm font-bold min-w-[20px] text-center" data-testid={`text-solve-count-${note.id}`}>{note.solveCount ?? 0}</span>
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-5 w-5"
                                disabled={updateSolveCountMutation.isPending}
                                onClick={() => updateSolveCountMutation.mutate({ noteId: note.id, solveCount: (note.solveCount ?? 0) + 1 })}
                                data-testid={`button-solve-plus-${note.id}`}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                        {isTeacher && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button size="sm" variant="ghost" data-testid={`menu-note-${note.id}`}>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                setRenamingNoteId(note.id);
                                setRenameNoteTitle(note.title);
                                setShowRenameNoteDialog(true);
                              }}>
                                <Pencil className="h-4 w-4 mr-2" /> 이름 변경
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                setMovingNoteId(note.id);
                                setShowMoveDialog(true);
                              }}>
                                <MoveRight className="h-4 w-4 mr-2" /> 폴더 이동
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm(`"${note.title}" 오답노트를 삭제하시겠습니까?`)) {
                                  deleteNoteMutation.mutate(note.id);
                                }
                              }}>
                                <Trash2 className="h-4 w-4 mr-2" /> 삭제
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                        {!isTeacher && isStudent && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button size="sm" variant="ghost" data-testid={`menu-student-note-${note.id}`}>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                setMovingNoteId(note.id);
                                setShowMoveDialog(true);
                              }}>
                                <MoveRight className="h-4 w-4 mr-2" /> 폴더 이동
                              </DropdownMenuItem>
                              {isMyNote && (
                                <DropdownMenuItem className="text-destructive" onClick={(e) => {
                                  e.stopPropagation();
                                  if (window.confirm(`"${note.title}" 오답노트를 삭제하시겠습니까?`)) {
                                    deleteNoteMutation.mutate(note.id);
                                  }
                                }}>
                                  <Trash2 className="h-4 w-4 mr-2" /> 삭제
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          )}
        </>
      )}

      {isTeacher && tab === "student-notes" && (
        <>
          {selectedStudentForNotes ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelectedStudentForNotes(null)} data-testid="button-back-student-list">
                  <ArrowLeft className="h-4 w-4 mr-1" /> 학생 목록
                </Button>
                <h3 className="text-lg font-bold" data-testid="text-selected-student-name">
                  {studentCreatedData?.students.find((s: any) => s.id === selectedStudentForNotes)?.name}의 오답노트
                </h3>
                <Badge variant="secondary">{selectedStudentNotes.length}개</Badge>
              </div>
              <div className="space-y-2">
                {selectedStudentNotes.length === 0 ? (
                  <Card><CardContent className="py-10 text-center text-muted-foreground">오답노트가 없습니다.</CardContent></Card>
                ) : (
                  selectedStudentNotes.map((note: any) => (
                    <Card key={note.id} className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => { setSelectedNoteId(note.id); setView("wrong-note"); }}
                      data-testid={`card-student-note-${note.id}`}
                    >
                      <CardContent className="p-4">
                        <h3 className="font-medium">{note.title}</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          {note.createdAt && new Date(note.createdAt).toLocaleDateString("ko-KR")}
                        </p>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="학생 검색..."
                    value={studentNoteSearch}
                    onChange={(e) => setStudentNoteSearch(e.target.value)}
                    className="pl-9"
                    data-testid="input-student-note-search"
                  />
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant={studentNoteGrade === null ? "default" : "outline"}
                  onClick={() => setStudentNoteGrade(null)}
                  data-testid="button-grade-all"
                >
                  전체
                </Button>
                {studentNoteGrades.map((g: string) => (
                  <Button
                    key={g}
                    size="sm"
                    variant={studentNoteGrade === g ? "default" : "outline"}
                    onClick={() => setStudentNoteGrade(g)}
                    data-testid={`button-grade-${g}`}
                  >
                    {g}
                  </Button>
                ))}
              </div>
              <div className="space-y-2">
                {filteredStudents.length === 0 ? (
                  <Card><CardContent className="py-10 text-center text-muted-foreground">해당 학년에 오답노트를 만든 학생이 없습니다.</CardContent></Card>
                ) : (
                  filteredStudents.map((student: any) => (
                    <Card key={student.id} className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => setSelectedStudentForNotes(student.id)}
                      data-testid={`card-student-${student.id}`}
                    >
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{student.name}</span>
                          {student.grade && <Badge variant="outline" className="text-xs">{student.grade}</Badge>}
                        </div>
                        <Badge variant="secondary">{student.noteCount}개</Badge>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>문제집 등록</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">문제집 이름</label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="예: 고1 이차함수 개념편"
                data-testid="input-new-workbook-title"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              AI 이용비용: 1페이지당 90원 (충전 잔액에서 차감)
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>취소</Button>
            <Button
              onClick={() => createWorkbookMutation.mutate()}
              disabled={!newTitle.trim() || createWorkbookMutation.isPending}
              data-testid="button-confirm-create"
            >
              {createWorkbookMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              등록
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showFolderDialog} onOpenChange={(open) => { if (!open) { setShowFolderDialog(false); setEditingFolder(null); setFolderName(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingFolder ? "폴더 이름 변경" : "새 폴더 만들기"}</DialogTitle>
          </DialogHeader>
          <Input
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            placeholder="폴더 이름"
            data-testid="input-folder-name"
            onKeyDown={(e) => {
              if (e.key === "Enter" && folderName.trim()) {
                editingFolder ? updateFolderMutation.mutate() : createFolderMutation.mutate();
              }
            }}
          />
          {!editingFolder && currentFolderId && (
            <p className="text-xs text-muted-foreground">
              현재 위치: {folderPath.map(f => f.name).join(" / ") || "전체"}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowFolderDialog(false); setEditingFolder(null); setFolderName(""); }}>취소</Button>
            <Button
              onClick={() => editingFolder ? updateFolderMutation.mutate() : createFolderMutation.mutate()}
              disabled={!folderName.trim() || createFolderMutation.isPending || updateFolderMutation.isPending}
              data-testid="button-confirm-folder"
            >
              {(createFolderMutation.isPending || updateFolderMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {editingFolder ? "변경" : "만들기"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showMoveDialog} onOpenChange={(open) => { if (!open) { setShowMoveDialog(false); setMovingNoteId(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>오답노트 이동</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            <button
              className={`w-full text-left px-3 py-2 rounded-md hover:bg-muted flex items-center gap-2 ${!currentFolderId ? "font-bold" : ""}`}
              onClick={() => moveNoteMutation.mutate({ noteId: movingNoteId!, folderId: null })}
              data-testid="move-to-root"
            >
              <FolderOpen className="h-4 w-4 text-yellow-500" />
              전체 (최상위)
            </button>
            {folders.map(f => (
              <button
                key={f.id}
                className={`w-full text-left px-3 py-2 rounded-md hover:bg-muted flex items-center gap-2 ${f.id === currentFolderId ? "font-bold" : ""}`}
                onClick={() => moveNoteMutation.mutate({ noteId: movingNoteId!, folderId: f.id })}
                data-testid={`move-to-${f.id}`}
              >
                <Folder className="h-4 w-4 text-yellow-500" />
                {(() => {
                  const parts: string[] = [];
                  let current: FolderItem | undefined = f;
                  while (current) {
                    parts.unshift(current.name);
                    current = folders.find(p => p.id === current!.parentId);
                  }
                  return parts.join(" / ");
                })()}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showRenameNoteDialog} onOpenChange={(open) => { if (!open) { setShowRenameNoteDialog(false); setRenamingNoteId(null); setRenameNoteTitle(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>오답노트 이름 변경</DialogTitle>
          </DialogHeader>
          <Input
            value={renameNoteTitle}
            onChange={(e) => setRenameNoteTitle(e.target.value)}
            placeholder="오답노트 이름"
            data-testid="input-rename-note"
            onKeyDown={(e) => {
              if (e.key === "Enter" && renameNoteTitle.trim()) renameNoteMutation.mutate();
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowRenameNoteDialog(false); setRenamingNoteId(null); setRenameNoteTitle(""); }}>취소</Button>
            <Button
              onClick={() => renameNoteMutation.mutate()}
              disabled={!renameNoteTitle.trim() || renameNoteMutation.isPending}
              data-testid="button-confirm-rename-note"
            >
              {renameNoteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              변경
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showWbFolderDialog} onOpenChange={(open) => { if (!open) { setShowWbFolderDialog(false); setEditingWbFolder(null); setWbFolderName(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingWbFolder ? "폴더 이름 변경" : "새 폴더 만들기"}</DialogTitle>
          </DialogHeader>
          <Input
            value={wbFolderName}
            onChange={(e) => setWbFolderName(e.target.value)}
            placeholder="폴더 이름"
            data-testid="input-wb-folder-name"
            onKeyDown={(e) => {
              if (e.key === "Enter" && wbFolderName.trim()) {
                editingWbFolder ? updateWbFolderMutation.mutate() : createWbFolderMutation.mutate();
              }
            }}
          />
          {!editingWbFolder && wbCurrentFolderId && (
            <p className="text-xs text-muted-foreground">
              현재 위치: {wbFolderPath.map(f => f.name).join(" / ") || "전체"}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowWbFolderDialog(false); setEditingWbFolder(null); setWbFolderName(""); }}>취소</Button>
            <Button
              onClick={() => editingWbFolder ? updateWbFolderMutation.mutate() : createWbFolderMutation.mutate()}
              disabled={!wbFolderName.trim() || createWbFolderMutation.isPending || updateWbFolderMutation.isPending}
              data-testid="button-confirm-wb-folder"
            >
              {(createWbFolderMutation.isPending || updateWbFolderMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {editingWbFolder ? "변경" : "만들기"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showWbMoveDialog} onOpenChange={(open) => { if (!open) { setShowWbMoveDialog(false); setMovingWbId(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>문제집 이동</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            <button
              className={`w-full text-left px-3 py-2 rounded-md hover:bg-muted flex items-center gap-2 ${!wbCurrentFolderId ? "font-bold" : ""}`}
              onClick={() => moveWbMutation.mutate({ wbId: movingWbId!, folderId: null })}
              data-testid="wb-move-to-root"
            >
              <FolderOpen className="h-4 w-4 text-yellow-500" />
              전체 (최상위)
            </button>
            {wbFolders.map(f => (
              <button
                key={f.id}
                className={`w-full text-left px-3 py-2 rounded-md hover:bg-muted flex items-center gap-2 ${f.id === wbCurrentFolderId ? "font-bold" : ""}`}
                onClick={() => moveWbMutation.mutate({ wbId: movingWbId!, folderId: f.id })}
                data-testid={`wb-move-to-${f.id}`}
              >
                <Folder className="h-4 w-4 text-yellow-500" />
                {(() => {
                  const parts: string[] = [];
                  let current: FolderItem | undefined = f;
                  while (current) {
                    parts.unshift(current.name);
                    current = wbFolders.find(p => p.id === current!.parentId);
                  }
                  return parts.join(" / ");
                })()}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showRenameWbDialog} onOpenChange={(open) => { if (!open) { setShowRenameWbDialog(false); setRenamingWbId(null); setRenameWbTitle(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>문제집 이름 변경</DialogTitle>
          </DialogHeader>
          <Input
            value={renameWbTitle}
            onChange={(e) => setRenameWbTitle(e.target.value)}
            placeholder="문제집 이름"
            data-testid="input-rename-wb"
            onKeyDown={(e) => {
              if (e.key === "Enter" && renameWbTitle.trim()) renameWbMutation.mutate();
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowRenameWbDialog(false); setRenamingWbId(null); setRenameWbTitle(""); }}>취소</Button>
            <Button
              onClick={() => renameWbMutation.mutate()}
              disabled={!renameWbTitle.trim() || renameWbMutation.isPending}
              data-testid="button-confirm-rename-wb"
            >
              {renameWbMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              변경
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
