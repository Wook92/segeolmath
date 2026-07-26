import { useState, useEffect, useRef, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Lock, User, Clock, MessageSquare, PanelLeft, PanelRight, GripVertical, Menu, RotateCcw, ImageIcon, Upload, X, HelpCircle, Eye, EyeOff, GraduationCap, Loader2, Shield, CheckCircle2, ExternalLink, Smartphone, CreditCard, Coins, ChevronDown, ChevronRight } from "lucide-react";
import { InstallGuideAdminSettings } from "@/components/install-guide-admin";
import { BugReportDialog } from "@/components/bug-report-dialog";
import { PushNotificationSettings } from "@/components/push-notification-manager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { invalidateQueriesStartingWith } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { UserRole, type UserMenuOrder, type Feature, type CenterFeature, type Center, type MessageTemplate, type TeacherCheckInSettings, type SolapiManual, SolapiManualType, type SmsCredit, type SmsCreditTransaction } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSidebarPosition } from "@/lib/sidebar-position-context";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface SubMenuItem {
  menuKey: string;
  name: string;
  featureId: string;
  isHidden: boolean;
}

function SortableSubMenuItem({ sub, isParentHidden, isAdminOrPrincipal, onToggleSubItemHidden }: {
  sub: SubMenuItem;
  isParentHidden?: boolean;
  isAdminOrPrincipal?: boolean;
  onToggleSubItemHidden?: (featureId: string, isHidden: boolean) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sub.menuKey });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-2 bg-muted/50 border rounded-md text-sm ${sub.isHidden || isParentHidden ? "opacity-50" : ""}`}
      data-testid={`sub-menu-item-${sub.menuKey}`}
    >
      <div className="cursor-grab active:cursor-grabbing touch-none flex items-center" {...attributes} {...listeners}>
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
      </div>
      <span className={`flex-1 ${sub.isHidden || isParentHidden ? "line-through text-muted-foreground" : ""}`}>
        {sub.name}
      </span>
      {isAdminOrPrincipal && onToggleSubItemHidden && !isParentHidden && (
        <button
          onClick={() => onToggleSubItemHidden(sub.featureId, !sub.isHidden)}
          className="p-1 rounded hover:bg-muted"
          title={sub.isHidden ? "메뉴 보이기" : "메뉴 숨기기"}
          data-testid={`toggle-hidden-sub-${sub.menuKey}`}
        >
          {sub.isHidden ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" /> : <Eye className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>
      )}
    </div>
  );
}

interface SortableMenuItemProps {
  id: string;
  title: string;
  subItems?: SubMenuItem[];
  isHidden?: boolean;
  featureId?: string;
  isAdminOrPrincipal?: boolean;
  onToggleHidden?: (featureId: string, isHidden: boolean) => void;
  onToggleSubItemHidden?: (featureId: string, isHidden: boolean) => void;
  onSubItemReorder?: (parentKey: string, newOrder: string[]) => void;
}

function SortableMenuItem({ id, title, subItems, isHidden, featureId, isAdminOrPrincipal, onToggleHidden, onToggleSubItemHidden, onSubItemReorder }: SortableMenuItemProps) {
  const [expanded, setExpanded] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : undefined,
  };

  const hasSubItems = subItems && subItems.length > 0;

  const subSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleSubDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id && subItems && onSubItemReorder) {
      const oldIndex = subItems.findIndex(s => s.menuKey === active.id);
      const newIndex = subItems.findIndex(s => s.menuKey === over.id);
      const newOrder = arrayMove(subItems, oldIndex, newIndex).map(s => s.menuKey);
      onSubItemReorder(id, newOrder);
    }
  };

  return (
    <div data-testid={`menu-item-${id}`}>
      <div
        ref={setNodeRef}
        style={style}
        className={`flex items-center gap-2 p-3 bg-card border rounded-md ${isHidden ? "opacity-50" : ""}`}
      >
        <div className="cursor-grab active:cursor-grabbing touch-none flex items-center" {...attributes} {...listeners}>
          <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        </div>
        {hasSubItems && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-0.5 rounded hover:bg-muted"
            data-testid={`toggle-expand-${id}`}
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        )}
        <span className={`flex-1 ${isHidden ? "line-through text-muted-foreground" : ""}`}>{title}</span>
        {isAdminOrPrincipal && featureId && onToggleHidden && (
          <button
            onClick={() => onToggleHidden(featureId, !isHidden)}
            className="p-1 rounded hover:bg-muted"
            title={isHidden ? "메뉴 보이기" : "메뉴 숨기기"}
            data-testid={`toggle-hidden-${id}`}
          >
            {isHidden ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
          </button>
        )}
      </div>
      {hasSubItems && expanded && (
        <div className="ml-8 mt-1 space-y-1">
          <DndContext
            sensors={subSensors}
            collisionDetection={closestCenter}
            onDragEnd={handleSubDragEnd}
          >
            <SortableContext
              items={subItems.map(s => s.menuKey)}
              strategy={verticalListSortingStrategy}
            >
              {subItems.map((sub) => (
                <SortableSubMenuItem
                  key={sub.menuKey}
                  sub={sub}
                  isParentHidden={isHidden}
                  isAdminOrPrincipal={isAdminOrPrincipal}
                  onToggleSubItemHidden={onToggleSubItemHidden}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  );
}

// SOLAPI Manual Types
const SOLAPI_MANUAL_TYPES = [
  { id: SolapiManualType.BUSINESS_REGISTRATION, label: "사업자 등록", description: "SOLAPI 사업자 등록 방법" },
  { id: SolapiManualType.API_KEY, label: "API Key 등록", description: "API Key 발급 및 등록 방법" },
  { id: SolapiManualType.PAYMENT, label: "결제 등록", description: "결제 수단 등록 방법" },
];

// SOLAPI Manual Manager Component (Admin only)
function SolapiManualManager({ userId }: { userId?: string }) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState<string | null>(null);
  const [editingManual, setEditingManual] = useState<string | null>(null);
  const [formData, setFormData] = useState<{ title: string; linkUrl: string; description: string }>({
    title: "",
    linkUrl: "",
    description: "",
  });
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  const { data: manuals = [], refetch } = useQuery<SolapiManual[]>({
    queryKey: ["/api/solapi-manuals"],
  });

  const getManualByType = (manualType: string) => 
    manuals.find((m) => m.manualType === manualType);

  const handleSave = async (manualType: string) => {
    if (!userId) return;
    setUploading(manualType);
    
    try {
      const formDataObj = new FormData();
      formDataObj.append("manualType", manualType);
      formDataObj.append("title", formData.title || SOLAPI_MANUAL_TYPES.find(t => t.id === manualType)?.label || "");
      formDataObj.append("linkUrl", formData.linkUrl);
      formDataObj.append("description", formData.description);

      const fileInput = fileInputRefs.current[manualType];
      if (fileInput?.files?.[0]) {
        formDataObj.append("image", fileInput.files[0]);
      }

      await fetch(`/api/solapi-manuals?actorId=${userId}`, {
        method: "POST",
        body: formDataObj,
      });

      toast({ title: "매뉴얼이 저장되었습니다" });
      refetch();
      setEditingManual(null);
      setFormData({ title: "", linkUrl: "", description: "" });
    } catch (error) {
      toast({ title: "저장에 실패했습니다", variant: "destructive" });
    } finally {
      setUploading(null);
    }
  };

  const handleDelete = async (manualType: string) => {
    if (!userId) return;
    try {
      await apiRequest("DELETE", `/api/solapi-manuals/${manualType}?actorId=${userId}`);
      toast({ title: "매뉴얼이 삭제되었습니다" });
      refetch();
    } catch (error) {
      toast({ title: "삭제에 실패했습니다", variant: "destructive" });
    }
  };

  const startEdit = (manualType: string) => {
    const existing = getManualByType(manualType);
    setEditingManual(manualType);
    setFormData({
      title: existing?.title || SOLAPI_MANUAL_TYPES.find(t => t.id === manualType)?.label || "",
      linkUrl: existing?.linkUrl || "",
      description: existing?.description || "",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5" />
          SOLAPI 매뉴얼 관리
        </CardTitle>
        <CardDescription>
          원장이 SOLAPI 설정 시 참고할 수 있는 매뉴얼을 등록합니다 (URL 또는 이미지)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {SOLAPI_MANUAL_TYPES.map((type) => {
          const manual = getManualByType(type.id);
          const isEditing = editingManual === type.id;

          return (
            <div key={type.id} className="p-4 border rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{type.label}</p>
                  <p className="text-sm text-muted-foreground">{type.description}</p>
                </div>
                {!isEditing && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => startEdit(type.id)}
                      data-testid={`button-edit-solapi-manual-${type.id}`}
                    >
                      {manual ? "수정" : "등록"}
                    </Button>
                    {manual && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(type.id)}
                        data-testid={`button-delete-solapi-manual-${type.id}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {isEditing && (
                <div className="space-y-3 pt-2 border-t">
                  <div className="space-y-2">
                    <Label>제목</Label>
                    <Input
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="매뉴얼 제목"
                      data-testid={`input-solapi-manual-title-${type.id}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>링크 URL (선택)</Label>
                    <Input
                      value={formData.linkUrl}
                      onChange={(e) => setFormData(prev => ({ ...prev, linkUrl: e.target.value }))}
                      placeholder="https://..."
                      data-testid={`input-solapi-manual-url-${type.id}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>이미지 (선택)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        accept="image/*"
                        ref={(el) => { fileInputRefs.current[type.id] = el; }}
                        data-testid={`input-solapi-manual-image-${type.id}`}
                      />
                    </div>
                    {manual?.imageUrl && (
                      <div className="mt-2">
                        <img src={manual.imageUrl} alt="현재 이미지" className="max-h-32 rounded border" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>설명 (선택)</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="추가 설명"
                      rows={2}
                      data-testid={`input-solapi-manual-description-${type.id}`}
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingManual(null);
                        setFormData({ title: "", linkUrl: "", description: "" });
                      }}
                    >
                      취소
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleSave(type.id)}
                      disabled={uploading === type.id}
                      data-testid={`button-save-solapi-manual-${type.id}`}
                    >
                      {uploading === type.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "저장"}
                    </Button>
                  </div>
                </div>
              )}

              {!isEditing && manual && (
                <div className="text-sm space-y-1">
                  {manual.linkUrl && (
                    <p>
                      <span className="text-muted-foreground">링크:</span>{" "}
                      <a href={manual.linkUrl} target="_blank" rel="noopener noreferrer" className="underline">
                        {manual.linkUrl}
                      </a>
                    </p>
                  )}
                  {manual.imageUrl && (
                    <p className="text-muted-foreground">이미지 등록됨</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// SOLAPI Manual Viewer Component (Principal view)
function SolapiManualViewer() {
  const { data: manuals = [], isLoading } = useQuery<SolapiManual[]>({
    queryKey: ["/api/solapi-manuals"],
  });
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="mb-4 p-4 bg-muted rounded-lg flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 p-4 bg-muted rounded-lg">
        <p className="font-medium mb-2 flex items-center gap-2">
          <HelpCircle className="h-4 w-4" />
          SOLAPI 설정 도움말
        </p>
        <div className="space-y-4">
          {SOLAPI_MANUAL_TYPES.map((type) => {
            const manual = manuals.find((m) => m.manualType === type.id);

            return (
              <div key={type.id} className="border-b border-border/50 pb-3 last:border-0 last:pb-0">
                <div className="flex items-center gap-3 text-sm mb-2">
                  <span className="font-medium min-w-[100px]">{type.label}:</span>
                  <div className="flex gap-2">
                    {manual ? (
                      <>
                        {manual.linkUrl && (
                          <a
                            href={manual.linkUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline text-sm"
                            data-testid={`link-solapi-manual-${type.id}`}
                          >
                            매뉴얼 보기
                          </a>
                        )}
                        {!manual.linkUrl && !manual.imageUrl && (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground">등록되지 않음</span>
                    )}
                  </div>
                </div>
                {manual?.imageUrl && (
                  <div className="mt-2">
                    <img 
                      src={manual.imageUrl} 
                      alt={`${type.label} 매뉴얼`} 
                      className="w-full rounded-md border cursor-pointer hover:opacity-90 transition-opacity"
                      style={{ imageRendering: 'auto' }}
                      data-testid={`img-solapi-manual-${type.id}`}
                      onClick={() => setViewingImage(manual.imageUrl!)}
                      title="클릭하면 크게 볼 수 있습니다"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 이미지 확대 다이얼로그 - 전체화면 */}
      <Dialog open={!!viewingImage} onOpenChange={() => setViewingImage(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-auto h-auto overflow-auto p-4">
          <DialogHeader className="sr-only">
            <DialogTitle>매뉴얼 이미지</DialogTitle>
          </DialogHeader>
          {viewingImage && (
            <img 
              src={viewingImage} 
              alt="매뉴얼" 
              className="max-w-full max-h-[90vh] object-contain"
              style={{ imageRendering: 'auto' }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// SMS Setup Guide Manager Component (Admin only)
interface SmsSetupGuideStep {
  id: string;
  stepNumber: number;
  title: string;
  description: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  linkText: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

function ApiCreationGuideConfig({ userId }: { userId?: string }) {
  const { toast } = useToast();
  const [apiCreationUrl, setApiCreationUrl] = useState("");
  const [apiCreationDescription, setApiCreationDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingImage, setDeletingImage] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { data: guideData, refetch } = useQuery<{ url: string; imageUrls: string[]; description: string | null }>({
    queryKey: ["/api/sms-settings/api-creation-guide"],
  });

  useEffect(() => {
    if (guideData) {
      setApiCreationUrl(guideData.url || "");
      setApiCreationDescription(guideData.description || "");
    }
  }, [guideData]);

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("url", apiCreationUrl);
      formData.append("description", apiCreationDescription);
      
      const fileInput = fileInputRef.current;
      if (fileInput?.files) {
        for (let i = 0; i < fileInput.files.length; i++) {
          formData.append("images", fileInput.files[i]);
        }
      }

      const response = await fetch(`/api/sms-settings/api-creation-guide?userId=${userId}`, {
        method: "PUT",
        body: formData,
      });

      if (!response.ok) throw new Error("Failed to save");

      toast({ title: "API 생성 안내가 저장되었습니다" });
      refetch();
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      toast({ title: "저장에 실패했습니다", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteImage = async (index: number, imageUrl: string) => {
    if (!userId) return;
    setDeletingImage(index);
    try {
      const response = await fetch(`/api/sms-settings/api-creation-guide/image?userId=${userId}&imageUrl=${encodeURIComponent(imageUrl)}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete");
      toast({ title: "이미지가 삭제되었습니다" });
      refetch();
    } catch (error) {
      toast({ title: "이미지 삭제에 실패했습니다", variant: "destructive" });
    } finally {
      setDeletingImage(null);
    }
  };

  return (
    <div className="p-4 border rounded-lg space-y-3 bg-muted/30">
      <p className="font-medium text-sm">2. API 생성 안내 페이지</p>
      <p className="text-xs text-muted-foreground">
        원장이 API Key 생성 방법을 안내받는 페이지입니다
      </p>
      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">API 생성 페이지 URL</Label>
          <Input
            value={apiCreationUrl}
            onChange={(e) => setApiCreationUrl(e.target.value)}
            placeholder="https://console.solapi.com/credentials"
            data-testid="input-api-creation-url"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">안내 설명</Label>
          <Textarea
            value={apiCreationDescription}
            onChange={(e) => setApiCreationDescription(e.target.value)}
            placeholder="API Key 생성 방법을 설명해주세요"
            rows={2}
            data-testid="input-api-creation-description"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">안내 이미지 (여러 장 선택 가능)</Label>
          <Input
            type="file"
            accept="image/*"
            multiple
            ref={fileInputRef}
            data-testid="input-api-creation-image"
          />
          {guideData?.imageUrls && guideData.imageUrls.length > 0 && (
            <div className="mt-2 space-y-2">
              <p className="text-xs text-muted-foreground">현재 이미지 ({guideData.imageUrls.length}개):</p>
              <div className="grid grid-cols-2 gap-2">
                {guideData.imageUrls.map((url, index) => (
                  <div key={index} className="relative group">
                    <img src={url} alt={`API 생성 안내 ${index + 1}`} className="w-full h-24 object-cover rounded border" />
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleDeleteImage(index, url)}
                      disabled={deletingImage === index}
                      data-testid={`button-delete-api-image-${index}`}
                    >
                      {deletingImage === index ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                    </Button>
                    <span className="absolute bottom-1 left-1 bg-black/50 text-white text-xs px-1 rounded">{index + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <Button size="sm" onClick={handleSave} disabled={saving} data-testid="button-save-api-creation-guide">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "저장"}
        </Button>
      </div>
    </div>
  );
}

function CredentialsGuideConfig({ userId }: { userId?: string }) {
  const { toast } = useToast();
  const [credentialsUrl, setCredentialsUrl] = useState("");
  const [credentialsDescription, setCredentialsDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingImage, setDeletingImage] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { data: guideData, refetch } = useQuery<{ url: string; imageUrls: string[]; description: string | null }>({
    queryKey: ["/api/sms-settings/credentials-guide"],
  });

  useEffect(() => {
    if (guideData) {
      setCredentialsUrl(guideData.url || "");
      setCredentialsDescription(guideData.description || "");
    }
  }, [guideData]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("url", credentialsUrl);
      formData.append("description", credentialsDescription);
      
      const fileInput = fileInputRef.current;
      if (fileInput?.files) {
        for (let i = 0; i < fileInput.files.length; i++) {
          formData.append("images", fileInput.files[i]);
        }
      }

      const response = await fetch(`/api/sms-settings/credentials-guide?userId=${userId}`, {
        method: "PUT",
        body: formData,
      });

      if (!response.ok) throw new Error("Failed to save");

      toast({ title: "자격 증명 안내가 저장되었습니다" });
      refetch();
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      toast({ title: "저장에 실패했습니다", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteImage = async (index: number, imageUrl: string) => {
    if (!userId) return;
    setDeletingImage(index);
    try {
      const response = await fetch(`/api/sms-settings/credentials-guide/image?userId=${userId}&imageUrl=${encodeURIComponent(imageUrl)}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete");
      toast({ title: "이미지가 삭제되었습니다" });
      refetch();
    } catch (error) {
      toast({ title: "이미지 삭제에 실패했습니다", variant: "destructive" });
    } finally {
      setDeletingImage(null);
    }
  };

  return (
    <div className="p-4 border rounded-lg space-y-3 bg-muted/30">
      <p className="font-medium text-sm">3. API 자격 증명 입력 안내</p>
      <p className="text-xs text-muted-foreground">
        원장이 API Key, Secret Key, 발신번호를 복사하는 방법을 안내하는 페이지입니다
      </p>
      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">자격 증명 페이지 URL</Label>
          <Input
            value={credentialsUrl}
            onChange={(e) => setCredentialsUrl(e.target.value)}
            placeholder="https://console.solapi.com/credentials"
            data-testid="input-credentials-url"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">안내 설명</Label>
          <Textarea
            value={credentialsDescription}
            onChange={(e) => setCredentialsDescription(e.target.value)}
            placeholder="API Key, Secret Key, 발신번호 복사 방법을 설명해주세요"
            rows={2}
            data-testid="input-credentials-description"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">안내 이미지 (여러 장 선택 가능)</Label>
          <Input
            type="file"
            accept="image/*"
            multiple
            ref={fileInputRef}
            data-testid="input-credentials-image"
          />
          {guideData?.imageUrls && guideData.imageUrls.length > 0 && (
            <div className="mt-2 space-y-2">
              <p className="text-xs text-muted-foreground">현재 이미지 ({guideData.imageUrls.length}개):</p>
              <div className="grid grid-cols-2 gap-2">
                {guideData.imageUrls.map((url, index) => (
                  <div key={index} className="relative group">
                    <img src={url} alt={`자격 증명 안내 ${index + 1}`} className="w-full h-24 object-cover rounded border" />
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleDeleteImage(index, url)}
                      disabled={deletingImage === index}
                      data-testid={`button-delete-credentials-image-${index}`}
                    >
                      {deletingImage === index ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                    </Button>
                    <span className="absolute bottom-1 left-1 bg-black/50 text-white text-xs px-1 rounded">{index + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <Button size="sm" onClick={handleSave} disabled={saving} data-testid="button-save-credentials-guide">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "저장"}
        </Button>
      </div>
    </div>
  );
}

function TestSmsSection({ centerId, userId }: { centerId: string; userId: string }) {
  const { toast } = useToast();
  const [recipientPhone, setRecipientPhone] = useState("");
  const [sending, setSending] = useState(false);

  const handleSendTestSms = async () => {
    if (!recipientPhone.trim()) {
      toast({ title: "수신자 번호를 입력해주세요", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      const response = await fetch(`/api/sms-settings/send-test-sms?userId=${userId}&centerId=${centerId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          recipientPhone: recipientPhone.replace(/-/g, ""),
          message: "문자 연결이 완료되었습니다. [새결수학]"
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "발송 실패");
      }

      toast({ title: "테스트 문자가 발송되었습니다" });
      setRecipientPhone("");
    } catch (error: any) {
      toast({ title: error.message || "문자 발송에 실패했습니다", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg space-y-3 bg-muted/30">
      <p className="font-medium text-sm">테스트 문자 발송</p>
      <p className="text-xs text-muted-foreground">
        문자 연결이 정상적으로 완료되었는지 테스트해보세요.
      </p>
      <div className="flex gap-2">
        <Input
          type="tel"
          value={recipientPhone}
          onChange={(e) => setRecipientPhone(e.target.value)}
          placeholder="수신자 번호 (예: 010-1234-5678)"
          className="flex-1"
          data-testid="input-test-sms-recipient"
        />
        <Button 
          onClick={handleSendTestSms} 
          disabled={sending || !recipientPhone.trim()}
          data-testid="button-send-test-sms"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "발송"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        발송 내용: "문자 연결이 완료되었습니다. [새결수학]"
      </p>
    </div>
  );
}

function SmsSetupGuideManager({ userId }: { userId?: string }) {
  const { toast } = useToast();
  const [editingStep, setEditingStep] = useState<SmsSetupGuideStep | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [formData, setFormData] = useState({
    stepNumber: 1,
    title: "",
    description: "",
    linkUrl: "",
    linkText: "",
  });
  const [signupUrl, setSignupUrl] = useState("");
  const [savingSignupUrl, setSavingSignupUrl] = useState(false);
  const [businessInfoUrl, setBusinessInfoUrl] = useState("");
  const [savingBusinessInfoUrl, setSavingBusinessInfoUrl] = useState(false);
  const [senderNumberUrl, setSenderNumberUrl] = useState("");
  const [savingSenderNumberUrl, setSavingSenderNumberUrl] = useState(false);

  const { data: steps = [], refetch } = useQuery<SmsSetupGuideStep[]>({
    queryKey: ["/api/sms-setup-guide"],
  });

  const { data: signupUrlData } = useQuery<{ url: string }>({
    queryKey: ["/api/sms-settings/signup-url"],
  });

  const { data: businessInfoUrlData } = useQuery<{ url: string }>({
    queryKey: ["/api/sms-settings/business-info-url"],
  });

  const { data: senderNumberUrlData } = useQuery<{ url: string }>({
    queryKey: ["/api/sms-settings/sender-number-url"],
  });

  useEffect(() => {
    if (signupUrlData?.url) {
      setSignupUrl(signupUrlData.url);
    }
  }, [signupUrlData]);

  useEffect(() => {
    if (businessInfoUrlData?.url) {
      setBusinessInfoUrl(businessInfoUrlData.url);
    }
  }, [businessInfoUrlData]);

  useEffect(() => {
    if (senderNumberUrlData?.url) {
      setSenderNumberUrl(senderNumberUrlData.url);
    }
  }, [senderNumberUrlData]);

  const handleSaveSignupUrl = async () => {
    if (!userId || !signupUrl) return;
    setSavingSignupUrl(true);
    try {
      await apiRequest("PUT", `/api/sms-settings/signup-url?userId=${userId}`, { url: signupUrl });
      toast({ title: "회원가입 URL이 저장되었습니다" });
    } catch (error) {
      toast({ title: "저장에 실패했습니다", variant: "destructive" });
    } finally {
      setSavingSignupUrl(false);
    }
  };

  const handleSaveBusinessInfoUrl = async () => {
    if (!userId || !businessInfoUrl) return;
    setSavingBusinessInfoUrl(true);
    try {
      await apiRequest("PUT", `/api/sms-settings/business-info-url?userId=${userId}`, { url: businessInfoUrl });
      toast({ title: "사업자정보 등록 URL이 저장되었습니다" });
    } catch (error) {
      toast({ title: "저장에 실패했습니다", variant: "destructive" });
    } finally {
      setSavingBusinessInfoUrl(false);
    }
  };

  const handleSaveSenderNumberUrl = async () => {
    if (!userId || !senderNumberUrl) return;
    setSavingSenderNumberUrl(true);
    try {
      await apiRequest("PUT", `/api/sms-settings/sender-number-url?userId=${userId}`, { url: senderNumberUrl });
      toast({ title: "발신번호 설정 URL이 저장되었습니다" });
    } catch (error) {
      toast({ title: "저장에 실패했습니다", variant: "destructive" });
    } finally {
      setSavingSenderNumberUrl(false);
    }
  };

  const resetForm = () => {
    setFormData({
      stepNumber: steps.length + 1,
      title: "",
      description: "",
      linkUrl: "",
      linkText: "",
    });
    setEditingStep(null);
    setIsAdding(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!userId) return;
    if (!formData.title) {
      toast({ title: "제목을 입력해주세요", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const formDataObj = new FormData();
      formDataObj.append("stepNumber", formData.stepNumber.toString());
      formDataObj.append("title", formData.title);
      formDataObj.append("description", formData.description);
      formDataObj.append("linkUrl", formData.linkUrl);
      formDataObj.append("linkText", formData.linkText);

      const fileInput = fileInputRef.current;
      if (fileInput?.files?.[0]) {
        formDataObj.append("image", fileInput.files[0]);
      }

      const url = editingStep
        ? `/api/sms-setup-guide/${editingStep.id}?userId=${userId}`
        : `/api/sms-setup-guide?userId=${userId}`;

      const response = await fetch(url, {
        method: editingStep ? "PUT" : "POST",
        body: formDataObj,
      });

      if (!response.ok) {
        throw new Error("Failed to save");
      }

      toast({ title: editingStep ? "수정되었습니다" : "추가되었습니다" });
      refetch();
      resetForm();
    } catch (error) {
      console.error("Failed to save step:", error);
      toast({ title: "저장에 실패했습니다", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!userId) return;
    if (!confirm("이 단계를 삭제하시겠습니까?")) return;

    try {
      await apiRequest("DELETE", `/api/sms-setup-guide/${id}?userId=${userId}`);
      toast({ title: "삭제되었습니다" });
      refetch();
    } catch (error) {
      toast({ title: "삭제에 실패했습니다", variant: "destructive" });
    }
  };

  const startEdit = (step: SmsSetupGuideStep) => {
    setEditingStep(step);
    setIsAdding(false);
    setFormData({
      stepNumber: step.stepNumber,
      title: step.title,
      description: step.description || "",
      linkUrl: step.linkUrl || "",
      linkText: step.linkText || "",
    });
  };

  const startAdd = () => {
    setIsAdding(true);
    setEditingStep(null);
    setFormData({
      stepNumber: steps.length + 1,
      title: "",
      description: "",
      linkUrl: "",
      linkText: "",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5" />
          SMS 연결 가이드 관리
        </CardTitle>
        <CardDescription>
          원장이 SMS 연결 시 참고할 수 있는 단계별 가이드를 관리합니다
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* SOLAPI Signup URL Configuration */}
        <div className="p-4 border rounded-lg space-y-3 bg-muted/30">
          <p className="font-medium text-sm">1. SOLAPI 회원가입 페이지 URL</p>
          <p className="text-xs text-muted-foreground">
            원장이 "계정 없음"을 선택했을 때 연결될 회원가입 페이지입니다
          </p>
          <div className="flex gap-2">
            <Input
              value={signupUrl}
              onChange={(e) => setSignupUrl(e.target.value)}
              placeholder="https://console.solapi.com/signup"
              className="flex-1"
              data-testid="input-solapi-signup-url"
            />
            <Button 
              size="sm" 
              onClick={handleSaveSignupUrl} 
              disabled={savingSignupUrl}
              data-testid="button-save-signup-url"
            >
              {savingSignupUrl ? <Loader2 className="h-4 w-4 animate-spin" /> : "저장"}
            </Button>
          </div>
        </div>

        <div className="p-4 border rounded-lg space-y-3 bg-muted/30">
          <p className="font-medium text-sm">1-1. 사업자정보 등록 페이지 URL</p>
          <p className="text-xs text-muted-foreground">
            원장이 사업자 정보를 등록할 수 있는 SOLAPI 페이지입니다
          </p>
          <div className="flex gap-2">
            <Input
              value={businessInfoUrl}
              onChange={(e) => setBusinessInfoUrl(e.target.value)}
              placeholder="https://console.solapi.com/business"
              className="flex-1"
              data-testid="input-solapi-business-info-url"
            />
            <Button 
              size="sm" 
              onClick={handleSaveBusinessInfoUrl} 
              disabled={savingBusinessInfoUrl}
              data-testid="button-save-business-info-url"
            >
              {savingBusinessInfoUrl ? <Loader2 className="h-4 w-4 animate-spin" /> : "저장"}
            </Button>
          </div>
        </div>

        <div className="p-4 border rounded-lg space-y-3 bg-muted/30">
          <p className="font-medium text-sm">1-2. 발신번호 설정 페이지 URL</p>
          <p className="text-xs text-muted-foreground">
            원장이 발신번호를 등록할 수 있는 SOLAPI 페이지입니다
          </p>
          <div className="flex gap-2">
            <Input
              value={senderNumberUrl}
              onChange={(e) => setSenderNumberUrl(e.target.value)}
              placeholder="https://console.solapi.com/senderids"
              className="flex-1"
              data-testid="input-solapi-sender-number-url"
            />
            <Button 
              size="sm" 
              onClick={handleSaveSenderNumberUrl} 
              disabled={savingSenderNumberUrl}
              data-testid="button-save-sender-number-url"
            >
              {savingSenderNumberUrl ? <Loader2 className="h-4 w-4 animate-spin" /> : "저장"}
            </Button>
          </div>
        </div>

        {/* API Creation Guide Configuration */}
        <ApiCreationGuideConfig userId={userId} />

        <CredentialsGuideConfig userId={userId} />

        <Separator />

        {/* Existing Steps List */}
        {steps.map((step) => (
          <div key={step.id} className="p-4 border rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center">
                  {step.stepNumber}
                </span>
                <span className="font-medium">{step.title}</span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => startEdit(step)}
                  data-testid={`button-edit-sms-guide-${step.id}`}
                >
                  수정
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(step.id)}
                  data-testid={`button-delete-sms-guide-${step.id}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {step.description && (
              <p className="text-sm text-muted-foreground pl-8">{step.description}</p>
            )}
            {step.imageUrl && (
              <div className="pl-8">
                <img src={step.imageUrl} alt={step.title} className="max-h-32 rounded border" />
              </div>
            )}
            {step.linkUrl && (
              <p className="text-sm pl-8">
                <a href={step.linkUrl} target="_blank" rel="noopener noreferrer" className="underline">
                  {step.linkText || step.linkUrl}
                </a>
              </p>
            )}
          </div>
        ))}

        {/* Add/Edit Form */}
        {(isAdding || editingStep) && (
          <div className="p-4 border rounded-lg space-y-3 bg-muted/50">
            <p className="font-medium">{editingStep ? "단계 수정" : "새 단계 추가"}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>단계 번호</Label>
                <Input
                  type="number"
                  min={1}
                  value={formData.stepNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, stepNumber: parseInt(e.target.value) || 1 }))}
                  data-testid="input-sms-guide-step-number"
                />
              </div>
              <div className="space-y-2">
                <Label>제목 *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="SOLAPI 회원가입"
                  data-testid="input-sms-guide-title"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>설명</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="이 단계에서 수행해야 할 작업을 설명해주세요"
                rows={3}
                data-testid="input-sms-guide-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>링크 URL</Label>
                <Input
                  value={formData.linkUrl}
                  onChange={(e) => setFormData(prev => ({ ...prev, linkUrl: e.target.value }))}
                  placeholder="https://console.solapi.com"
                  data-testid="input-sms-guide-link-url"
                />
              </div>
              <div className="space-y-2">
                <Label>링크 텍스트</Label>
                <Input
                  value={formData.linkText}
                  onChange={(e) => setFormData(prev => ({ ...prev, linkText: e.target.value }))}
                  placeholder="SOLAPI 콘솔 바로가기"
                  data-testid="input-sms-guide-link-text"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>가이드 이미지</Label>
              <Input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                data-testid="input-sms-guide-image"
              />
              {editingStep?.imageUrl && (
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground mb-1">현재 이미지:</p>
                  <img src={editingStep.imageUrl} alt="현재 이미지" className="max-h-24 rounded border" />
                </div>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={resetForm}>
                취소
              </Button>
              <Button size="sm" onClick={handleSave} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : (editingStep ? "수정" : "추가")}
              </Button>
            </div>
          </div>
        )}

        {/* Add Button */}
        {!isAdding && !editingStep && (
          <Button variant="outline" onClick={startAdd} className="w-full" data-testid="button-add-sms-guide-step">
            + 단계 추가
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// Onboarding manual card - shown above the connection status card
function SolapiOnboardingManualCard({ centerId, userId }: { centerId: string; userId: string }) {
  const [showWizard, setShowWizard] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <HelpCircle className="h-5 w-5" />
          SOLAPI 온보딩 매뉴얼
        </CardTitle>
        <CardDescription>
          SOLAPI 설정 과정을 다시 확인할 수 있습니다
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          variant={showWizard ? "default" : "outline"}
          size="sm"
          onClick={() => setShowWizard(!showWizard)}
          data-testid="button-toggle-onboarding-manual"
        >
          <HelpCircle className="h-4 w-4 mr-1" />
          {showWizard ? "매뉴얼 닫기" : "매뉴얼 보기"}
        </Button>
        {showWizard && (
          <div className="mt-4">
            <SmsConnectionWizard
              centerId={centerId}
              userId={userId}
              onComplete={() => setShowWizard(false)}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DirectSmsWithCreditSwitch({ centerId, userId, onCreditComplete }: { centerId: string; userId: string; onCreditComplete: () => void }) {
  const [showCreditSetup, setShowCreditSetup] = useState(false);

  if (showCreditSetup) {
    return (
      <SmsCreditSetup
        centerId={centerId}
        onComplete={onCreditComplete}
        onBack={() => setShowCreditSetup(false)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-md bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
          <span className="font-medium text-green-700 dark:text-green-300">문자 전송 가능 (직접 등록)</span>
        </div>
        <p className="text-sm text-green-600 dark:text-green-400 mt-2">
          SMS/카카오톡 알림이 정상적으로 설정되어 있습니다.
        </p>
      </div>
      <SolapiOnboardingManualCard centerId={centerId} userId={userId} />
      <TestSmsSection centerId={centerId} userId={userId} />
      <SolapiManualViewer />

      <div className="pt-2 border-t">
        <Button
          variant="outline"
          className="w-full border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950"
          onClick={() => setShowCreditSetup(true)}
          data-testid="button-switch-to-credit-mode"
        >
          <CreditCard className="h-4 w-4 mr-2" />
          충전하여 문자 사용하기로 전환
        </Button>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          SMS 28원 / LMS 55원 / MMS 120원 — 충전금 결제 후 차감 방식
        </p>
      </div>
    </div>
  );
}

function ChargeTossSettings({ userId, userRole }: { userId: string; userRole: number }) {
  const { toast } = useToast();
  const isAdmin = userRole === 4;
  const [chargeClientKey, setChargeClientKey] = useState("");
  const [chargeSecretKey, setChargeSecretKey] = useState("");
  const [showCK, setShowCK] = useState(false);
  const [showSK, setShowSK] = useState(false);

  const { data: chargeSettings, isLoading } = useQuery<{
    configured: boolean;
    maskedClientKey: string | null;
    maskedSecretKey: string | null;
  }>({
    queryKey: ["/api/charge-toss-settings"],
    queryFn: () => fetch(`/api/charge-toss-settings?actorId=${userId}`).then(r => r.json()),
    enabled: !!userId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", `/api/charge-toss-settings?actorId=${userId}`, {
        clientKey: chargeClientKey,
        secretKey: chargeSecretKey,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/charge-toss-settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/toss/config"] });
      toast({ title: "충전용 토스페이먼츠 키가 저장되었습니다" });
      setChargeClientKey("");
      setChargeSecretKey("");
    },
    onError: (error: any) => {
      toast({ title: error.message || "저장 실패", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/charge-toss-settings?actorId=${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/charge-toss-settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/toss/config"] });
      toast({ title: "충전용 토스페이먼츠 키가 삭제되었습니다" });
    },
    onError: () => {
      toast({ title: "삭제 실패", variant: "destructive" });
    },
  });

  const [revealed, setRevealed] = useState(false);
  const [revealedKeys, setRevealedKeys] = useState<{ clientKey: string | null; secretKey: string | null } | null>(null);
  const [revealLoading, setRevealLoading] = useState(false);

  const handleReveal = async () => {
    if (revealed) {
      setRevealed(false);
      setRevealedKeys(null);
      return;
    }
    setRevealLoading(true);
    try {
      const res = await fetch(`/api/charge-toss-settings/reveal?actorId=${userId}`);
      const data = await res.json();
      if (res.ok) {
        setRevealedKeys(data);
        setRevealed(true);
      }
    } catch {
    } finally {
      setRevealLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          충전용 토스페이먼츠 설정
        </CardTitle>
        <CardDescription>
          원장이 충전형 문자 크레딧을 결제할 때 사용되는 키입니다. 관리자만 등록할 수 있습니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : chargeSettings?.configured ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
              <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-green-800 dark:text-green-200">설정 완료</p>
                <p className="text-sm text-green-600 dark:text-green-400">
                  충전용 결제가 활성화되어 있습니다.
                </p>
              </div>
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (confirm("정말 충전용 토스 설정을 삭제하시겠습니까?")) {
                      deleteMutation.mutate();
                    }
                  }}
                  disabled={deleteMutation.isPending}
                  data-testid="button-delete-charge-toss"
                >
                  {deleteMutation.isPending ? "삭제 중..." : "설정 삭제"}
                </Button>
              )}
            </div>

            <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">현재 저장된 키</p>
                {isAdmin && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleReveal}
                    disabled={revealLoading}
                    data-testid="button-reveal-charge-toss-keys"
                  >
                    {revealLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : revealed ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                    {revealed ? "숨기기" : "전체 보기"}
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-20 flex-shrink-0">클라이언트 키:</span>
                  <code className="text-xs bg-muted px-2 py-1 rounded font-mono break-all" data-testid="text-charge-client-key">
                    {revealed && revealedKeys?.clientKey ? revealedKeys.clientKey : (chargeSettings.maskedClientKey || "미설정")}
                  </code>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-20 flex-shrink-0">시크릿 키:</span>
                  <code className="text-xs bg-muted px-2 py-1 rounded font-mono break-all" data-testid="text-charge-secret-key">
                    {revealed && revealedKeys?.secretKey ? revealedKeys.secretKey : (chargeSettings.maskedSecretKey || "미설정")}
                  </code>
                </div>
              </div>
            </div>

            {isAdmin && (
              <p className="text-sm text-muted-foreground">
                키를 변경하려면 아래에 새 키를 입력 후 저장하세요.
              </p>
            )}
          </div>
        ) : (
          <div className="p-4 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
            <p className="text-sm text-orange-700 dark:text-orange-300">
              충전용 토스페이먼츠 키가 아직 등록되지 않았습니다. {isAdmin ? "아래에서 등록해주세요." : "관리자에게 등록을 요청하세요."}
            </p>
          </div>
        )}

        {isAdmin && (
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <Label>클라이언트 키</Label>
              <div className="relative">
                <Input
                  type={showCK ? "text" : "password"}
                  value={chargeClientKey}
                  onChange={(e) => setChargeClientKey(e.target.value)}
                  placeholder="test_ck_ 또는 live_ck_ 로 시작"
                  data-testid="input-charge-toss-client-key"
                />
                <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3" onClick={() => setShowCK(!showCK)}>
                  {showCK ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>시크릿 키</Label>
              <div className="relative">
                <Input
                  type={showSK ? "text" : "password"}
                  value={chargeSecretKey}
                  onChange={(e) => setChargeSecretKey(e.target.value)}
                  placeholder="test_sk_ 또는 live_sk_ 로 시작"
                  data-testid="input-charge-toss-secret-key"
                />
                <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3" onClick={() => setShowSK(!showSK)}>
                  {showSK ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                토스페이먼츠 개발자센터 → 내 개발 정보 → API 키에서 확인
              </p>
            </div>
            <Button
              type="submit"
              disabled={saveMutation.isPending || !chargeClientKey || !chargeSecretKey}
              data-testid="button-save-charge-toss"
            >
              {saveMutation.isPending ? "저장 중..." : "설정 저장"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function CreditAdjustment({ userId }: { userId: string }) {
  const { toast } = useToast();
  const [selectedCenterId, setSelectedCenterId] = useState("");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustType, setAdjustType] = useState<"add" | "subtract">("add");

  const { data: centers } = useQuery<any[]>({
    queryKey: ["/api/centers"],
  });

  const creditCenters = centers?.filter((c: any) => c.smsMode === "credit") || [];

  const { data: creditInfo, refetch: refetchCredit } = useQuery<{ balance: number }>({
    queryKey: ["/api/sms-credits", selectedCenterId],
    queryFn: () => fetch(`/api/sms-credits/${selectedCenterId}?actorId=${userId}`).then(r => r.json()),
    enabled: !!selectedCenterId,
  });

  const { data: transactions, refetch: refetchTransactions } = useQuery<any[]>({
    queryKey: ["/api/sms-credit-transactions", selectedCenterId],
    queryFn: () => fetch(`/api/sms-credit-transactions/${selectedCenterId}?actorId=${userId}&limit=20`).then(r => r.json()),
    enabled: !!selectedCenterId,
  });

  const adjustMutation = useMutation({
    mutationFn: async () => {
      const numAmount = parseInt(adjustAmount);
      if (isNaN(numAmount) || numAmount <= 0) throw new Error("올바른 금액을 입력해주세요");
      const finalAmount = adjustType === "subtract" ? -numAmount : numAmount;
      const res = await apiRequest("POST", `/api/sms-credits/${selectedCenterId}/adjust`, {
        amount: finalAmount,
        reason: adjustReason || undefined,
        actorId: userId,
      });
      return res;
    },
    onSuccess: () => {
      toast({ title: `잔액이 ${adjustType === "add" ? "증액" : "감액"}되었습니다` });
      setAdjustAmount("");
      setAdjustReason("");
      refetchCredit();
      refetchTransactions();
    },
    onError: (error: any) => {
      toast({ title: error.message || "조정 실패", variant: "destructive" });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coins className="h-5 w-5" />
          충전액 조정
        </CardTitle>
        <CardDescription>충전형 문자를 사용하는 센터의 잔액을 직접 조정할 수 있습니다.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {creditCenters.length === 0 ? (
          <p className="text-sm text-muted-foreground">충전형 문자를 사용하는 센터가 없습니다.</p>
        ) : (
          <>
            <div className="space-y-2">
              <Label>센터 선택</Label>
              <Select value={selectedCenterId} onValueChange={setSelectedCenterId}>
                <SelectTrigger data-testid="select-credit-center">
                  <SelectValue placeholder="센터를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {creditCenters.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedCenterId && (
              <>
                <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">현재 잔액</span>
                    <span className="text-lg font-bold text-blue-700 dark:text-blue-300" data-testid="text-current-balance">
                      {(creditInfo?.balance || 0).toLocaleString()}원
                    </span>
                  </div>
                </div>

                <div className="space-y-3 p-4 border rounded-lg">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={adjustType === "add" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setAdjustType("add")}
                      data-testid="button-adjust-add"
                    >
                      증액
                    </Button>
                    <Button
                      type="button"
                      variant={adjustType === "subtract" ? "destructive" : "outline"}
                      size="sm"
                      onClick={() => setAdjustType("subtract")}
                      data-testid="button-adjust-subtract"
                    >
                      감액
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label>조정 금액 (원)</Label>
                    <Input
                      type="number"
                      min="1"
                      value={adjustAmount}
                      onChange={(e) => setAdjustAmount(e.target.value)}
                      placeholder="금액 입력"
                      data-testid="input-adjust-amount"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>사유 (선택)</Label>
                    <Input
                      value={adjustReason}
                      onChange={(e) => setAdjustReason(e.target.value)}
                      placeholder="예: 이벤트 보너스, 오류 정정 등"
                      data-testid="input-adjust-reason"
                    />
                  </div>
                  <Button
                    onClick={() => {
                      const num = parseInt(adjustAmount);
                      if (isNaN(num) || num <= 0) {
                        toast({ title: "올바른 금액을 입력해주세요", variant: "destructive" });
                        return;
                      }
                      if (confirm(`${adjustType === "add" ? "증액" : "감액"} ${num.toLocaleString()}원을 진행하시겠습니까?`)) {
                        adjustMutation.mutate();
                      }
                    }}
                    disabled={adjustMutation.isPending || !adjustAmount}
                    className="w-full"
                    variant={adjustType === "subtract" ? "destructive" : "default"}
                    data-testid="button-adjust-confirm"
                  >
                    {adjustMutation.isPending ? "처리 중..." : `${adjustType === "add" ? "증액" : "감액"} 적용`}
                  </Button>
                </div>

                {transactions && transactions.length > 0 && (
                  <div className="space-y-2">
                    <Label>최근 거래 내역</Label>
                    <div className="max-h-60 overflow-y-auto border rounded-lg">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 sticky top-0">
                          <tr>
                            <th className="text-left p-2">일시</th>
                            <th className="text-left p-2">구분</th>
                            <th className="text-right p-2">금액</th>
                            <th className="text-left p-2">내용</th>
                          </tr>
                        </thead>
                        <tbody>
                          {transactions.map((tx: any) => (
                            <tr key={tx.id} className="border-t">
                              <td className="p-2 text-xs text-muted-foreground whitespace-nowrap">
                                {new Date(tx.createdAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                              </td>
                              <td className="p-2">
                                <span className={`text-xs px-1.5 py-0.5 rounded ${tx.type === "charge" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"}`}>
                                  {tx.type === "charge" ? "충전" : "차감"}
                                </span>
                              </td>
                              <td className={`p-2 text-right font-medium ${tx.amount > 0 ? "text-green-600" : "text-red-600"}`}>
                                {tx.amount > 0 ? "+" : ""}{tx.amount.toLocaleString()}원
                              </td>
                              <td className="p-2 text-xs text-muted-foreground">{tx.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// SMS Credit Setup Component (충전해서 문자 사용하기)
declare global {
  interface Window {
    TossPayments?: (clientKey: string) => {
      requestPayment: (method: string, options: any) => Promise<any>;
    };
  }
}

function SavedTossKeys({ centerId, maskedClientKey, maskedSecretKey }: { centerId: string; maskedClientKey: string | null; maskedSecretKey: string | null }) {
  const { user } = useAuth();
  const [revealed, setRevealed] = useState(false);
  const [revealedKeys, setRevealedKeys] = useState<{ clientKey: string | null; secretKey: string | null } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleReveal = async () => {
    if (revealed) {
      setRevealed(false);
      setRevealedKeys(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/centers/${centerId}/toss-settings/reveal?actorId=${user?.id}`);
      const data = await res.json();
      if (res.ok) {
        setRevealedKeys(data);
        setRevealed(true);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">현재 저장된 키</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleReveal}
          disabled={loading}
          data-testid="button-reveal-toss-keys"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : revealed ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
          {revealed ? "숨기기" : "전체 보기"}
        </Button>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-20 flex-shrink-0">클라이언트 키:</span>
          <code className="text-xs bg-muted px-2 py-1 rounded font-mono break-all" data-testid="text-saved-client-key">
            {revealed && revealedKeys?.clientKey ? revealedKeys.clientKey : (maskedClientKey || "미설정")}
          </code>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-20 flex-shrink-0">시크릿 키:</span>
          <code className="text-xs bg-muted px-2 py-1 rounded font-mono break-all" data-testid="text-saved-secret-key">
            {revealed && revealedKeys?.secretKey ? revealedKeys.secretKey : (maskedSecretKey || "미설정")}
          </code>
        </div>
      </div>
    </div>
  );
}

function SmsCreditSetup({ centerId, onComplete, onBack }: { centerId: string; onComplete: () => void; onBack?: () => void }) {
  const { toast } = useToast();
  const [senderNumber, setSenderNumber] = useState("");
  const [chargeAmount, setChargeAmount] = useState(30000);
  const [showChargeDialog, setShowChargeDialog] = useState(false);
  const [isSetup, setIsSetup] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const { data: centerData } = useQuery<Center>({
    queryKey: ["/api/centers", centerId],
    queryFn: async () => {
      const res = await fetch("/api/centers");
      const centers: Center[] = await res.json();
      return centers.find(c => c.id === centerId) || null;
    },
    enabled: !!centerId,
  });

  const { data: tossConfig } = useQuery<{ available: boolean; clientKey: string | null }>({
    queryKey: ["/api/payments/toss/config"],
    queryFn: () => fetch(`/api/payments/toss/config`).then(r => r.json()),
  });

  const { data: credit } = useQuery<SmsCredit>({
    queryKey: ["/api/sms-credits", centerId],
    queryFn: () => fetch(`/api/sms-credits/${centerId}`).then(r => r.json()),
    enabled: !!centerId,
  });

  const { data: transactions = [] } = useQuery<SmsCreditTransaction[]>({
    queryKey: ["/api/sms-credit-transactions", centerId],
    queryFn: () => fetch(`/api/sms-credit-transactions/${centerId}?limit=20`).then(r => r.json()),
    enabled: !!centerId,
  });

  useEffect(() => {
    if (centerData && (centerData as any).smsMode === "credit") {
      setIsSetup(true);
      setSenderNumber((centerData as any).creditSenderNumber || "");
    }
  }, [centerData]);

  const setupMutation = useMutation({
    mutationFn: async () => {
      const cleaned = senderNumber.replace(/[^0-9]/g, "");
      if (!cleaned || cleaned.length < 8) {
        throw new Error("올바른 발신번호를 입력해주세요.");
      }
      await apiRequest("PUT", `/api/centers/${centerId}/sms-mode`, {
        smsMode: "credit",
        creditSenderNumber: cleaned,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/centers", centerId] });
      toast({ title: "충전형 문자 설정이 완료되었습니다" });
      setIsSetup(true);
    },
    onError: (error: any) => {
      toast({ title: error.message || "설정 실패", variant: "destructive" });
    },
  });

  const loadTossSDK = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (window.TossPayments) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = "https://js.tosspayments.com/v1/payment";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("토스 결제 모듈 로드 실패"));
      document.head.appendChild(script);
    });
  };

  const handleTossPayment = async () => {
    const clientKey = tossConfig?.clientKey;
    if (!clientKey) {
      toast({ title: "결제 키가 설정되지 않았습니다. 설정 > 결제 탭에서 토스페이먼츠 키를 먼저 등록해주세요.", variant: "destructive" });
      return;
    }
    if (!tossConfig?.available) {
      toast({ title: "토스페이먼츠 결제 키가 설정되지 않았습니다. 관리자에게 문의하세요.", variant: "destructive" });
      return;
    }
    try {
      await loadTossSDK();
    } catch {
      toast({ title: "결제 모듈을 불러올 수 없습니다. 네트워크를 확인해주세요.", variant: "destructive" });
      return;
    }

    if (chargeAmount < 30000) {
      toast({ title: "최소 충전 금액은 30,000원입니다.", variant: "destructive" });
      return;
    }

    const orderId = `sms-credit-${centerId.slice(0, 8)}-${Date.now()}`;
    const tossPayments = window.TossPayments(clientKey);
    const centerName = (centerData as any)?.name || "학원";

    try {
      setIsProcessingPayment(true);
      const result = await tossPayments.requestPayment("카드", {
        amount: chargeAmount,
        orderId,
        orderName: `문자 크레딧 충전 (${chargeAmount.toLocaleString()}원)`,
        customerName: centerName,
        successUrl: `${window.location.origin}/api/payments/toss/success`,
        failUrl: `${window.location.origin}/api/payments/toss/fail`,
      });

      if (result?.paymentKey) {
        const confirmRes = await apiRequest("POST", "/api/payments/toss/confirm", {
          paymentKey: result.paymentKey,
          orderId: result.orderId,
          amount: chargeAmount,
          centerId,
        });
        const confirmData = await confirmRes.json();
        if (confirmData.success) {
          queryClient.invalidateQueries({ queryKey: ["/api/sms-credits", centerId] });
          queryClient.invalidateQueries({ queryKey: ["/api/sms-credit-transactions", centerId] });
          setShowChargeDialog(false);
          toast({ title: `${chargeAmount.toLocaleString()}원이 충전되었습니다` });
        }
      }
    } catch (error: any) {
      if (error?.code === "USER_CANCEL" || error?.code === "PAY_PROCESS_CANCELED" || error?.code === "PAY_PROCESS_ABORTED") {
        return;
      }
      console.error("Toss payment error:", error);
      toast({ title: error?.message || "결제에 실패했습니다.", variant: "destructive" });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const updateSenderMutation = useMutation({
    mutationFn: async () => {
      const cleaned = senderNumber.replace(/[^0-9]/g, "");
      if (!cleaned || cleaned.length < 8) {
        throw new Error("올바른 발신번호를 입력해주세요.");
      }
      await apiRequest("PUT", `/api/centers/${centerId}/sms-mode`, {
        creditSenderNumber: cleaned,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/centers", centerId] });
      toast({ title: "발신번호가 변경되었습니다" });
    },
    onError: (error: any) => {
      toast({ title: error.message || "변경 실패", variant: "destructive" });
    },
  });

  if (!isSetup) {
    if (!centerData) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <div className="text-center py-2">
          <h3 className="text-lg font-medium mb-1">발신번호 등록</h3>
          <p className="text-sm text-muted-foreground">
            문자 발송에 사용할 발신번호를 입력해주세요.
          </p>
        </div>

        <div className="space-y-3 p-4 border rounded-lg">
          <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-md text-sm text-blue-700 dark:text-blue-300">
            <p className="font-medium mb-1">요금 안내</p>
            <div className="flex gap-4">
              <span>SMS: 28원</span>
              <span>LMS: 55원</span>
              <span>MMS: 120원</span>
            </div>
            <p className="mt-1 text-xs">최소 충전 금액: 30,000원</p>
          </div>

          <Label htmlFor="credit-sender">발신번호</Label>
          <Input
            id="credit-sender"
            value={senderNumber}
            onChange={(e) => setSenderNumber(e.target.value)}
            placeholder="01012345678"
            data-testid="input-credit-sender-number"
          />
          <p className="text-xs text-muted-foreground">
            발신번호는 사전에 SOLAPI에 등록된 번호여야 합니다. 관리자에게 문의해주세요.
          </p>
        </div>

        <div className="flex gap-2">
          {onBack && (
            <Button variant="outline" onClick={onBack} className="flex-1">
              이전
            </Button>
          )}
          <Button
            onClick={() => setupMutation.mutate()}
            disabled={!senderNumber || setupMutation.isPending}
            className="flex-1"
            data-testid="button-setup-credit-sms"
          >
            {setupMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            설정 완료
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-lg border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">발신번호</span>
        </div>
        <div className="flex gap-2 items-center">
          <Input
            value={senderNumber}
            onChange={(e) => setSenderNumber(e.target.value)}
            placeholder="01012345678"
            className="flex-1"
            data-testid="input-update-sender-number"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => updateSenderMutation.mutate()}
            disabled={updateSenderMutation.isPending}
            data-testid="button-update-sender"
          >
            변경
          </Button>
        </div>
        <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">
          ⚠ 발신번호를 변경하시려면 반드시 관리자에게 먼저 전달해주세요. 관리자 확인 없이 변경하면 문자 발송이 실패할 수 있습니다.
        </p>
      </div>

      <div className="p-3 bg-muted rounded-lg text-xs text-muted-foreground">
        <span className="font-medium">요금:</span> SMS 28원 · LMS 55원 · MMS 120원
      </div>

      <div className="p-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950">
        <p className="text-xs text-blue-700 dark:text-blue-300">
          💡 잔액 확인, 충전, 사용 내역은 <a href="/sms-credit-charge" className="underline font-medium">잔액충전</a> 메뉴에서 확인할 수 있습니다.
        </p>
      </div>
    </div>
  );
}

// SMS Connection Wizard Component (Principal view)
type WizardPhase = "choose_method" | "initial" | "account_created" | "business_info" | "sender_number" | "api_creation" | "guide_steps" | "credentials" | "credit_setup";

function SmsConnectionWizard({ 
  onComplete, 
  centerId, 
  userId 
}: { 
  onComplete: () => void; 
  centerId: string; 
  userId: string;
}) {
  const { toast } = useToast();
  const [showWizard, setShowWizard] = useState(false);
  const [phase, setPhase] = useState<WizardPhase>("choose_method");
  const [currentStep, setCurrentStep] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [senderNumber, setSenderNumber] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [showApiSecret, setShowApiSecret] = useState(false);

  const { data: steps = [], isLoading } = useQuery<SmsSetupGuideStep[]>({
    queryKey: ["/api/sms-setup-guide"],
  });

  const { data: signupUrlData } = useQuery<{ url: string }>({
    queryKey: ["/api/sms-settings/signup-url"],
  });

  const { data: apiCreationGuide } = useQuery<{ url: string; imageUrls: string[]; description: string | null }>({
    queryKey: ["/api/sms-settings/api-creation-guide"],
  });

  const { data: credentialsGuide } = useQuery<{ url: string; imageUrls: string[]; description: string | null }>({
    queryKey: ["/api/sms-settings/credentials-guide"],
  });

  const { data: businessInfoUrl } = useQuery<{ url: string }>({
    queryKey: ["/api/sms-settings/business-info-url"],
  });

  const { data: senderNumberUrl } = useQuery<{ url: string }>({
    queryKey: ["/api/sms-settings/sender-number-url"],
  });

  const [connectionSuccess, setConnectionSuccess] = useState(false);
  const [sendingTestSms, setSendingTestSms] = useState(false);

  const activeSteps = steps.filter(s => s.isActive !== false);

  const saveMutation = useMutation({
    mutationFn: async (data: { apiKey: string; apiSecret: string; senderNumber: string }) => {
      return apiRequest("PUT", `/api/centers/${centerId}/solapi`, data);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith(`/api/centers/${centerId}/solapi`);
      toast({ title: "SOLAPI 설정이 완료되었습니다" });
      setConnectionSuccess(true);
    },
    onError: () => {
      toast({ title: "저장에 실패했습니다", variant: "destructive" });
    },
  });

  const handleTestSms = async () => {
    setSendingTestSms(true);
    try {
      const response = await apiRequest("POST", `/api/sms-settings/test-sms?userId=${userId}&centerId=${centerId}`);
      if (response.ok) {
        toast({ title: "테스트 문자가 발송되었습니다" });
      }
    } catch (error: any) {
      toast({ title: error.message || "문자 발송에 실패했습니다", variant: "destructive" });
    } finally {
      setSendingTestSms(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey || !apiSecret || !senderNumber) {
      toast({ title: "모든 필드를 입력해주세요", variant: "destructive" });
      return;
    }
    saveMutation.mutate({ apiKey, apiSecret, senderNumber });
  };

  const resetWizard = () => {
    setShowWizard(false);
    setPhase("choose_method");
    setCurrentStep(0);
    setConfirmed(false);
    setApiKey("");
    setApiSecret("");
    setSenderNumber("");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!showWizard) {
    return (
      <div className="space-y-4">
        <div className="p-4 rounded-md bg-muted border">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">문자 연결이 필요합니다</span>
          </div>
          <p className="text-sm text-muted-foreground">
            SMS/카카오톡 알림을 발송하려면 SOLAPI 연결이 필요합니다.
          </p>
        </div>
        <Button 
          onClick={() => setShowWizard(true)} 
          className="w-full"
          data-testid="button-start-sms-connection"
        >
          문자 연결 시작
        </Button>
      </div>
    );
  }

  // Phase 0: Choose method
  if (phase === "choose_method") {
    return (
      <div className="space-y-4">
        <div className="text-center py-2">
          <h3 className="text-lg font-medium mb-1">문자 연결 방법을 선택해주세요</h3>
          <p className="text-sm text-muted-foreground">
            두 가지 방법 중 하나를 선택하실 수 있습니다.
          </p>
        </div>
        <div className="space-y-3">
          <button
            className="w-full p-4 rounded-lg border-2 hover:border-primary text-left transition-colors"
            onClick={() => setPhase("initial")}
            data-testid="button-direct-solapi"
          >
            <div className="font-medium mb-1">SOLAPI에 직접 가입하여 연결하기</div>
            <p className="text-sm text-muted-foreground">
              SOLAPI 계정을 직접 만들어 API를 연동합니다. 문자 비용은 SOLAPI에서 직접 관리합니다.
            </p>
          </button>
          <button
            className="w-full p-4 rounded-lg border-2 hover:border-primary text-left transition-colors"
            onClick={() => setPhase("credit_setup")}
            data-testid="button-credit-sms"
          >
            <div className="font-medium mb-1">충전해서 문자 사용하기</div>
            <p className="text-sm text-muted-foreground">
              충전금을 결제 후 문자를 사용합니다. SMS 28원, LMS 55원, MMS 120원으로 차감됩니다.
            </p>
          </button>
        </div>
        <Button variant="ghost" size="sm" onClick={resetWizard} className="w-full">
          취소
        </Button>
      </div>
    );
  }

  // Phase 1: Ask if user has SOLAPI account
  if (phase === "initial") {
    return (
      <div className="space-y-6">
        <div className="text-center py-4">
          <h3 className="text-lg font-medium mb-2">SOLAPI 계정이 있으신가요?</h3>
          <p className="text-sm text-muted-foreground">
            SMS/카카오톡 발송을 위해서는 SOLAPI 계정이 필요합니다.
          </p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            className="flex-1" 
            onClick={() => {
              const url = signupUrlData?.url || "https://console.solapi.com/signup";
              window.open(url, "_blank");
              setPhase("account_created");
            }}
            data-testid="button-no-account"
          >
            없음
          </Button>
          <Button 
            className="flex-1" 
            onClick={() => setPhase("business_info")}
            data-testid="button-has-account"
          >
            있음
          </Button>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setPhase("choose_method")}
          className="w-full"
        >
          이전
        </Button>
      </div>
    );
  }

  // Phase 2: Account created confirmation (after clicking "없음")
  if (phase === "account_created") {
    return (
      <div className="space-y-6">
        <div className="text-center py-4">
          <h3 className="text-lg font-medium mb-2">계정을 만드셨나요?</h3>
          <p className="text-sm text-muted-foreground">
            SOLAPI 회원가입을 완료하셨다면 다음 단계로 진행해주세요.
          </p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            className="flex-1" 
            onClick={() => setPhase("initial")}
          >
            이전
          </Button>
          <Button 
            className="flex-1" 
            onClick={() => setPhase("business_info")}
            data-testid="button-account-created-next"
          >
            다음
          </Button>
        </div>
      </div>
    );
  }

  // Phase 2.5: Business info registration
  if (phase === "business_info") {
    return (
      <div className="space-y-6">
        <div className="text-center py-4">
          <h3 className="text-lg font-medium mb-2">사업자 정보 등록</h3>
          <p className="text-sm text-muted-foreground">
            SOLAPI에서 사업자 정보를 등록해주세요.
          </p>
        </div>
        <Button 
          className="w-full" 
          onClick={() => {
            const url = businessInfoUrl?.url || "https://console.solapi.com/business";
            window.open(url, "_blank");
          }}
          data-testid="button-register-business-info"
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          사업자정보등록하기
        </Button>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            className="flex-1" 
            onClick={() => setPhase("account_created")}
          >
            이전
          </Button>
          <Button 
            className="flex-1" 
            onClick={() => setPhase("sender_number")}
            data-testid="button-business-info-next"
          >
            다음
          </Button>
        </div>
      </div>
    );
  }

  // Phase 2.6: Sender number setup
  if (phase === "sender_number") {
    return (
      <div className="space-y-6">
        <div className="text-center py-4">
          <h3 className="text-lg font-medium mb-2">발신번호 설정</h3>
          <p className="text-sm text-muted-foreground">
            SOLAPI에서 발신번호를 등록해주세요.
          </p>
        </div>
        <Button 
          className="w-full" 
          onClick={() => {
            const url = senderNumberUrl?.url || "https://console.solapi.com/senderids";
            window.open(url, "_blank");
          }}
          data-testid="button-setup-sender-number"
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          발신번호 설정하기
        </Button>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            className="flex-1" 
            onClick={() => setPhase("business_info")}
          >
            이전
          </Button>
          <Button 
            className="flex-1" 
            onClick={() => setPhase("api_creation")}
            data-testid="button-sender-number-next"
          >
            다음
          </Button>
        </div>
      </div>
    );
  }

  // Phase 3: API creation guide
  if (phase === "api_creation") {
    return (
      <div className="space-y-6">
        <div className="text-center py-2">
          <h3 className="text-lg font-medium mb-2">API Key 생성</h3>
          <p className="text-sm text-muted-foreground">
            SOLAPI 콘솔에서 API Key를 생성해주세요.
          </p>
        </div>
        
        <div className="p-4 rounded-lg bg-muted space-y-4">
          {apiCreationGuide?.description && (
            <p className="text-sm whitespace-pre-wrap">{apiCreationGuide.description}</p>
          )}
          {apiCreationGuide?.imageUrls && apiCreationGuide.imageUrls.length > 0 && (
            <div className="space-y-3">
              {apiCreationGuide.imageUrls.map((url, index) => (
                <div key={index} className="relative">
                  <img 
                    src={url} 
                    alt={`API 생성 안내 ${index + 1}`} 
                    className="w-full rounded-md border"
                  />
                  {apiCreationGuide.imageUrls.length > 1 && (
                    <span className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                      {index + 1} / {apiCreationGuide.imageUrls.length}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => {
              const url = apiCreationGuide?.url || "https://console.solapi.com/credentials";
              window.open(url, "_blank");
            }}
            data-testid="button-open-api-creation"
          >
            API Key 생성 페이지 열기
          </Button>
        </div>

        <div className="flex items-center gap-2 p-3 border rounded-md">
          <input
            type="checkbox"
            id="ip-confirm-api"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="w-4 h-4"
          />
          <label htmlFor="ip-confirm-api" className="text-sm text-red-600 dark:text-red-400">
            <strong>모든 IP 허용</strong> 설정을 완료했습니다
          </label>
        </div>

        <div className="flex gap-3">
          <Button 
            variant="outline" 
            className="flex-1" 
            onClick={() => setPhase("sender_number")}
          >
            이전
          </Button>
          <Button 
            className="flex-1" 
            onClick={() => setPhase(activeSteps.length > 0 ? "guide_steps" : "credentials")}
            disabled={!confirmed}
            data-testid="button-api-creation-next"
          >
            다음
          </Button>
        </div>
      </div>
    );
  }

  // Phase 4: Guide steps (existing functionality)
  if (phase === "guide_steps") {
    if (activeSteps.length === 0) {
      setPhase("credentials");
      return null;
    }

    const currentStepData = activeSteps[currentStep];
    const isLastStep = currentStep === activeSteps.length - 1;

    return (
      <div className="space-y-6">
        {/* Progress Indicator */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {activeSteps.map((step, index) => (
            <div
              key={step.id}
              className={`flex items-center gap-1 ${index <= currentStep ? "text-primary" : "text-muted-foreground"}`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  index < currentStep
                    ? "bg-primary text-primary-foreground"
                    : index === currentStep
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                {index < currentStep ? <CheckCircle2 className="h-4 w-4" /> : step.stepNumber}
              </div>
              {index < activeSteps.length - 1 && (
                <div className={`w-8 h-0.5 ${index < currentStep ? "bg-primary" : "bg-muted"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-muted">
            <h3 className="font-medium text-lg mb-2">
              {currentStepData?.stepNumber}. {currentStepData?.title}
            </h3>
            {currentStepData?.description && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap mb-4">
                {currentStepData.description}
              </p>
            )}
            {currentStepData?.linkUrl && (
              <a
                href={currentStepData.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary underline mb-4"
              >
                {currentStepData.linkText || "링크 열기"}
              </a>
            )}
            {currentStepData?.imageUrl && (
              <img
                src={currentStepData.imageUrl}
                alt={currentStepData.title}
                className="w-full rounded-md border"
              />
            )}
          </div>

          {/* Navigation */}
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => {
                if (currentStep === 0) {
                  setPhase("api_creation");
                } else {
                  setCurrentStep(prev => prev - 1);
                }
              }}
            >
              이전
            </Button>
            {isLastStep ? (
              <Button onClick={() => setPhase("credentials")}>
                설정 입력하기
              </Button>
            ) : (
              <Button onClick={() => setCurrentStep(prev => prev + 1)}>
                다음
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Phase: Credit setup (충전해서 문자 사용하기)
  if (phase === "credit_setup") {
    return (
      <SmsCreditSetup centerId={centerId} onComplete={onComplete} onBack={() => setPhase("choose_method")} />
    );
  }

  // Phase 5: Credentials input
  if (phase === "credentials") {
    // Show success screen with test SMS button after connection
    if (connectionSuccess) {
      return (
        <div className="space-y-4">
          <div className="p-4 rounded-md bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              <span className="font-medium text-green-800 dark:text-green-200">문자 연결 완료!</span>
            </div>
            <p className="text-sm text-green-700 dark:text-green-300">
              SOLAPI 연결이 완료되었습니다. 이제 문자 발송 기능을 사용할 수 있습니다.
            </p>
          </div>

          <div className="p-4 border rounded-lg space-y-3">
            <p className="font-medium">문자 테스트</p>
            <p className="text-sm text-muted-foreground">
              연결이 정상적으로 완료되었는지 테스트 문자를 발송해보세요.
              회원님의 핸드폰 번호로 테스트 문자가 발송됩니다.
            </p>
            <Button 
              onClick={handleTestSms} 
              disabled={sendingTestSms}
              data-testid="button-test-sms"
            >
              {sendingTestSms ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <MessageSquare className="h-4 w-4 mr-2" />}
              테스트 문자 발송
            </Button>
          </div>

          <Button onClick={onComplete} className="w-full">
            완료
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="p-4 rounded-md bg-muted border">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">연결 정보 입력</span>
          </div>
          <p className="text-sm text-muted-foreground">
            SOLAPI에서 발급받은 API Key와 Secret을 입력해주세요.
          </p>
        </div>

        {/* Credentials Guide from Admin */}
        {credentialsGuide && ((credentialsGuide.imageUrls && credentialsGuide.imageUrls.length > 0) || credentialsGuide.description) && (
          <div className="p-4 border rounded-lg space-y-3 bg-muted/30">
            <p className="font-medium text-sm">API 값 복사 방법</p>
            {credentialsGuide.description && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{credentialsGuide.description}</p>
            )}
            {credentialsGuide.imageUrls && credentialsGuide.imageUrls.length > 0 && (
              <div className="space-y-3">
                {credentialsGuide.imageUrls.map((url, index) => (
                  <div key={index} className="relative">
                    <img 
                      src={url} 
                      alt={`자격 증명 복사 안내 ${index + 1}`} 
                      className="w-full rounded-md border"
                    />
                    {credentialsGuide.imageUrls.length > 1 && (
                      <span className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                        {index + 1} / {credentialsGuide.imageUrls.length}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
            {credentialsGuide.url && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.open(credentialsGuide.url, "_blank")}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                SOLAPI 자격 증명 페이지 열기
              </Button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>API Key</Label>
            <div className="relative">
              <Input
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="SOLAPI에서 복사한 API Key"
                data-testid="input-api-key"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>API Secret</Label>
            <div className="relative">
              <Input
                type={showApiSecret ? "text" : "password"}
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder="SOLAPI에서 복사한 API Secret"
                data-testid="input-api-secret"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2"
                onClick={() => setShowApiSecret(!showApiSecret)}
              >
                {showApiSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>발신번호</Label>
            <p className="text-xs text-muted-foreground">
              이전 단계에서 SOLAPI에 등록한 발신번호를 입력해주세요
            </p>
            <Input
              value={senderNumber}
              onChange={(e) => setSenderNumber(e.target.value)}
              placeholder="예: 01012345678 (하이픈 없이)"
              data-testid="input-sender-number"
            />
          </div>
          <div className="flex gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setPhase(activeSteps.length > 0 ? "guide_steps" : "api_creation")} 
              className="flex-1"
            >
              이전으로
            </Button>
            <Button type="submit" disabled={saveMutation.isPending} className="flex-1">
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "완료"}
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return null;
}

// Logo Help Image Manager Component
const LOGO_TYPES = [
  { id: "loginLogo", label: "로그인 페이지", description: "로그인 화면 상단에 표시됩니다" },
  { id: "sidebarLogo", label: "사이드바", description: "사이드바/헤더에 표시됩니다" },
  { id: "favicon", label: "파비콘", description: "브라우저 탭 아이콘 (32x32 권장)" },
  { id: "attendancePadLogo", label: "출결패드", description: "출결패드 화면에 표시됩니다" },
  { id: "shortcutIcon", label: "바로가기 아이콘", description: "모바일 홈화면 아이콘 (192x192 권장)" },
];

interface LogoHelpImage {
  id: number;
  logoType: string;
  imageUrl: string;
  description: string | null;
}

function LogoHelpImageManager({ userId }: { userId?: string }) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  const { data: helpImages = [], refetch } = useQuery<LogoHelpImage[]>({
    queryKey: ["/api/logo-help-images"],
  });

  const handleUpload = async (logoType: string, file: File) => {
    if (!userId) return;
    
    setUploading(logoType);
    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("logoType", logoType);
      formData.append("description", LOGO_TYPES.find(t => t.id === logoType)?.label || logoType);
      
      const response = await fetch(`/api/logo-help-images?actorId=${userId}`, {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error("업로드 실패");
      }
      
      await refetch();
      toast({ title: "도움말 이미지가 등록되었습니다" });
    } catch (error) {
      toast({ title: "업로드 실패", description: "이미지 업로드 중 오류가 발생했습니다", variant: "destructive" });
    } finally {
      setUploading(null);
    }
  };

  const handleDelete = async (logoType: string) => {
    if (!userId) return;
    
    try {
      const response = await fetch(`/api/logo-help-images/${logoType}?actorId=${userId}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        throw new Error("삭제 실패");
      }
      
      await refetch();
      toast({ title: "도움말 이미지가 삭제되었습니다" });
    } catch (error) {
      toast({ title: "삭제 실패", description: "이미지 삭제 중 오류가 발생했습니다", variant: "destructive" });
    }
  };

  const getHelpImage = (logoType: string) => helpImages.find(h => h.logoType === logoType);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5" />
          로고 도움말 이미지 관리
        </CardTitle>
        <CardDescription>
          센터 등록 신청자들에게 보여줄 각 로고 유형별 사용 예시 이미지를 등록합니다
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {LOGO_TYPES.map((logoType) => {
            const helpImage = getHelpImage(logoType.id);
            const isUploading = uploading === logoType.id;
            
            return (
              <div key={logoType.id} className="border rounded-lg p-4 space-y-3">
                <div>
                  <h4 className="font-medium text-sm">{logoType.label}</h4>
                  <p className="text-xs text-muted-foreground">{logoType.description}</p>
                </div>
                
                <div className="aspect-video bg-muted rounded-md flex items-center justify-center overflow-hidden relative">
                  {helpImage?.imageUrl ? (
                    <>
                      <img 
                        src={helpImage.imageUrl} 
                        alt={`${logoType.label} 예시`}
                        className="w-full h-full object-contain"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6"
                        onClick={() => handleDelete(logoType.id)}
                        data-testid={`button-delete-help-${logoType.id}`}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </>
                  ) : (
                    <div className="text-center text-muted-foreground">
                      <ImageIcon className="h-8 w-8 mx-auto mb-1" />
                      <p className="text-xs">이미지 없음</p>
                    </div>
                  )}
                </div>
                
                <input
                  ref={(el) => { fileInputRefs.current[logoType.id] = el; }}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload(logoType.id, file);
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={isUploading}
                  onClick={() => fileInputRefs.current[logoType.id]?.click()}
                  data-testid={`button-upload-help-${logoType.id}`}
                >
                  {isUploading ? (
                    "업로드 중..."
                  ) : (
                    <>
                      <Upload className="h-3 w-3 mr-1" />
                      {helpImage ? "변경" : "업로드"}
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// Logo Help Button for Center Logo Manager
function LogoHelpPopup({ logoType, helpImages }: { logoType: string; helpImages: LogoHelpImage[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const helpImage = helpImages.find(h => h.logoType === logoType);
  const logoTypeInfo = LOGO_TYPES.find(t => t.id === logoType);
  
  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="text-muted-foreground hover-elevate rounded"
        data-testid={`button-logo-help-popup-${logoType}`}
      >
        <HelpCircle className="h-4 w-4" />
      </button>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{logoTypeInfo?.label || logoType} 사용 예시</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{logoTypeInfo?.description}</p>
            
            {helpImage?.imageUrl ? (
              <div className="rounded-md overflow-hidden border">
                <img 
                  src={helpImage.imageUrl} 
                  alt={`${logoTypeInfo?.label} 사용 예시`}
                  className="w-full object-contain max-h-96"
                />
                {helpImage.description && (
                  <p className="text-xs text-muted-foreground p-2 bg-muted">{helpImage.description}</p>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 bg-muted rounded-md">
                <HelpCircle className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">등록된 예시 이미지가 없습니다</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Center Logo Manager Component for Principals
function CenterLogoManager({ userId, center, refreshCenters }: { userId?: string; center: Center; refreshCenters?: () => Promise<void> }) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  
  // Fetch help images from admin
  const { data: helpImages = [] } = useQuery<LogoHelpImage[]>({
    queryKey: ["/api/logo-help-images"],
  });
  const [logos, setLogos] = useState<{ [key: string]: string | null }>({
    loginLogo: center.loginLogoUrl || null,
    sidebarLogo: center.sidebarLogoUrl || null,
    favicon: center.faviconUrl || null,
    attendancePadLogo: center.attendancePadLogoUrl || null,
    shortcutIcon: center.shortcutIconUrl || null,
  });

  useEffect(() => {
    setLogos({
      loginLogo: center.loginLogoUrl || null,
      sidebarLogo: center.sidebarLogoUrl || null,
      favicon: center.faviconUrl || null,
      attendancePadLogo: center.attendancePadLogoUrl || null,
      shortcutIcon: center.shortcutIconUrl || null,
    });
  }, [center]);

  const handleUpload = async (logoType: string, file: File) => {
    if (!userId) return;
    
    console.log(`[CenterLogo Upload] start - logoType: ${logoType}, fileName: ${file.name}, fileSize: ${file.size}, fileType: ${file.type}`);
    setUploading(logoType);
    try {
      // Get upload URL
      const uploadUrlResponse = await fetch(`/api/r2/upload-url?prefix=center-logos/${logoType}&actorId=${userId}`);
      if (!uploadUrlResponse.ok) {
        const txt = await uploadUrlResponse.text();
        console.error(`[CenterLogo Upload] upload-url failed: ${uploadUrlResponse.status} ${txt}`);
        throw new Error("업로드 URL 생성 실패");
      }
      const { uploadUrl, publicUrl } = await uploadUrlResponse.json();
      console.log(`[CenterLogo Upload] got publicUrl: ${publicUrl}`);
      
      // Upload file
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      console.log(`[CenterLogo Upload] R2 PUT status: ${putRes.status}`);
      if (!putRes.ok) {
        throw new Error(`R2 업로드 실패 (${putRes.status})`);
      }
      
      // Update center with new logo URL
      const logoField = logoType === "loginLogo" ? "loginLogoUrl" 
        : logoType === "sidebarLogo" ? "sidebarLogoUrl"
        : logoType === "favicon" ? "faviconUrl"
        : logoType === "attendancePadLogo" ? "attendancePadLogoUrl"
        : "shortcutIconUrl";
      
      const updateResponse = await fetch(`/api/centers/${center.id}?actorId=${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [logoField]: publicUrl }),
      });
      console.log(`[CenterLogo Upload] PATCH center status: ${updateResponse.status}, field: ${logoField}`);
      
      if (!updateResponse.ok) {
        const txt = await updateResponse.text();
        console.error(`[CenterLogo Upload] PATCH failed: ${txt}`);
        throw new Error("센터 정보 업데이트 실패");
      }
      
      const updated = await updateResponse.json();
      console.log(`[CenterLogo Upload] success - center.${logoField} = ${updated?.[logoField] ? String(updated[logoField]).substring(0, 80) + '...' : 'null'}`);
      
      setLogos(prev => ({ ...prev, [logoType]: publicUrl }));
      queryClient.invalidateQueries({ queryKey: ["/api/centers"] });
      if (refreshCenters) await refreshCenters();
      toast({ title: "로고가 등록되었습니다" });
    } catch (error: any) {
      console.error("[CenterLogo Upload] error:", error);
      toast({ title: "업로드 실패", description: error?.message || "로고 업로드 중 오류가 발생했습니다", variant: "destructive" });
    } finally {
      setUploading(null);
    }
  };

  const handleDelete = async (logoType: string) => {
    if (!userId) return;
    
    try {
      const logoField = logoType === "loginLogo" ? "loginLogoUrl" 
        : logoType === "sidebarLogo" ? "sidebarLogoUrl"
        : logoType === "favicon" ? "faviconUrl"
        : logoType === "attendancePadLogo" ? "attendancePadLogoUrl"
        : "shortcutIconUrl";
      
      const updateResponse = await fetch(`/api/centers/${center.id}?actorId=${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [logoField]: null }),
      });
      
      if (!updateResponse.ok) throw new Error("센터 정보 업데이트 실패");
      
      setLogos(prev => ({ ...prev, [logoType]: null }));
      queryClient.invalidateQueries({ queryKey: ["/api/centers"] });
      if (refreshCenters) await refreshCenters();
      toast({ title: "로고가 삭제되었습니다" });
    } catch (error) {
      toast({ title: "삭제 실패", description: "로고 삭제 중 오류가 발생했습니다", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          센터 로고 관리
        </CardTitle>
        <CardDescription>
          {center.name}의 로고를 등록하거나 변경합니다
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {LOGO_TYPES.map((logoType) => {
            const logoUrl = logos[logoType.id];
            const isUploading = uploading === logoType.id;
            
            return (
              <div key={logoType.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-medium text-sm">{logoType.label}</h4>
                    <p className="text-xs text-muted-foreground">{logoType.description}</p>
                  </div>
                  <LogoHelpPopup logoType={logoType.id} helpImages={helpImages} />
                </div>
                
                <div className="aspect-video bg-muted rounded-md flex items-center justify-center overflow-hidden relative">
                  {logoUrl ? (
                    <>
                      <img 
                        src={logoUrl} 
                        alt={`${logoType.label}`}
                        className="w-full h-full object-contain"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6"
                        onClick={() => handleDelete(logoType.id)}
                        data-testid={`button-delete-logo-${logoType.id}`}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </>
                  ) : (
                    <div className="text-center text-muted-foreground">
                      <ImageIcon className="h-8 w-8 mx-auto mb-1" />
                      <p className="text-xs">이미지 없음</p>
                    </div>
                  )}
                </div>
                
                <input
                  ref={(el) => { fileInputRefs.current[logoType.id] = el; }}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload(logoType.id, file);
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={isUploading}
                  onClick={() => fileInputRefs.current[logoType.id]?.click()}
                  data-testid={`button-upload-logo-${logoType.id}`}
                >
                  {isUploading ? (
                    "업로드 중..."
                  ) : (
                    <>
                      <Upload className="h-3 w-3 mr-1" />
                      {logoUrl ? "변경" : "업로드"}
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// Default menu items for each role (includes all sidebar menu items)
// IDs must match app-sidebar.tsx orderedMenuKeys (using group IDs for grouped menus)
const getDefaultMenuItems = (role: number): { id: string; title: string }[] => {
  // Note: "settings" is excluded - it's always fixed at the bottom and cannot be reordered
  // Only include TOP-LEVEL menu groups, not sub-items within collapsible groups
  if (role >= UserRole.ADMIN) {
    return [
      { id: "home", title: "대시보드" },
      { id: "centers", title: "센터 관리" },
      { id: "management", title: "경영" },
      { id: "users", title: "사용자 관리" },
      { id: "timetable", title: "시간표 관리" },
      { id: "class-management", title: "수업 관리" },
      { id: "schedule", title: "선생님" },
      { id: "student-management", title: "학생" },
      { id: "parent-portal", title: "학부모" },
    ];
  } else if (role >= UserRole.PRINCIPAL) {
    return [
      { id: "home", title: "대시보드" },
      { id: "management", title: "경영" },
      { id: "users", title: "사용자 관리" },
      { id: "timetable", title: "시간표 관리" },
      { id: "class-management", title: "수업 관리" },
      { id: "schedule", title: "선생님" },
      { id: "student-management", title: "학생" },
      { id: "parent-portal", title: "학부모" },
    ];
  } else if (role >= UserRole.TEACHER) {
    return [
      { id: "home", title: "대시보드" },
      { id: "users", title: "사용자 관리" },
      { id: "timetable", title: "시간표 관리" },
      { id: "class-management", title: "수업 관리" },
      { id: "schedule", title: "선생님" },
      { id: "student-management", title: "학생" },
      { id: "parent-portal", title: "학부모" },
    ];
  } else if (role === UserRole.STUDENT) {
    return [
      { id: "home", title: "홈" },
      { id: "student-timetable", title: "시간표" },
      { id: "student-lesson", title: "수업" },
      { id: "student-management", title: "학생" },
      { id: "parent-portal", title: "학부모" },
    ];
  } else {
    return [
      { id: "home", title: "홈" },
      { id: "parent-portal", title: "학부모" },
    ];
  }
};

export default function SettingsPage() {
  const { user, selectedCenter, refreshCenters } = useAuth();
  const { toast } = useToast();
  const { position: sidebarPosition, setPosition: setSidebarPosition } = useSidebarPosition();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // Profile edit state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState(user?.name || "");
  const [profilePhone, setProfilePhone] = useState(user?.phone || user?.username || "");
  
  // Menu order state
  const [menuItems, setMenuItems] = useState<{ id: string; title: string }[]>([]);
  const [hasMenuChanges, setHasMenuChanges] = useState(false);
  const [subMenuOrderState, setSubMenuOrderState] = useState<Record<string, string[]>>({});
  
  // Teacher check-in settings state
  const [smsRecipient1, setSmsRecipient1] = useState("");
  const [smsRecipient2, setSmsRecipient2] = useState("");
  const [messageTemplate, setMessageTemplate] = useState("");
  const [checkOutMsgTemplate, setCheckOutMsgTemplate] = useState("");
  const [isCheckInActive, setIsCheckInActive] = useState(true);
  
  // SMS Message templates state
  const [activeTab, setActiveTab] = useState("general");
  const [checkInMessage, setCheckInMessage] = useState("[{학원명}] {학생명} 학생이 출석하였습니다.");
  const [lateMessage, setLateMessage] = useState("[{학원명}] {학생명} 학생이 수업에 참여하지 않았습니다. 빠르게 등원할 수 있도록 해주세요.");
  const [checkOutMessage, setCheckOutMessage] = useState("[{학원명}] {학생명} 학생이 하원하였습니다.");
  const [teacherCheckInMessage, setTeacherCheckInMessage] = useState("[{센터명}] {선생님명} 선생님 출근 확인");
  const [teacherCheckOutMessage, setTeacherCheckOutMessage] = useState("[{센터명}] {선생님명} 선생님 퇴근 확인");
  
  // SOLAPI settings state (for Principal)
  const [solapiApiKey, setSolapiApiKey] = useState("");
  const [solapiApiSecret, setSolapiApiSecret] = useState("");
  const [solapiSenderNumber, setSolapiSenderNumber] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [showApiSecret, setShowApiSecret] = useState(false);
  const [showSavedApiKey, setShowSavedApiKey] = useState(false);
  const [showSavedApiSecret, setShowSavedApiSecret] = useState(false);
  const [revealedCredentials, setRevealedCredentials] = useState<{ apiKey?: string; apiSecret?: string } | null>(null);

  // Toss Payments settings state
  const [tossClientKey, setTossClientKey] = useState("");
  const [tossSecretKey, setTossSecretKey] = useState("");
  const [showTossClientKey, setShowTossClientKey] = useState(false);
  const [showTossSecretKey, setShowTossSecretKey] = useState(false);
  const [defaultTossClientKey, setDefaultTossClientKey] = useState("");
  const [defaultTossSecretKey, setDefaultTossSecretKey] = useState("");
  const [showDefaultTossClientKey, setShowDefaultTossClientKey] = useState(false);
  const [showDefaultTossSecretKey, setShowDefaultTossSecretKey] = useState(false);
  
  const isAdminOrPrincipal = user?.role === UserRole.PRINCIPAL || 
    user?.role === UserRole.ADMIN;
  const isAdmin = user?.role === UserRole.ADMIN;
  const isPrincipal = user?.role === UserRole.PRINCIPAL;

  const [paymentCenterId, setPaymentCenterId] = useState<string>("");

  const { data: allCentersForPayment } = useQuery<Center[]>({
    queryKey: ["/api/centers"],
    enabled: isAdmin,
  });

  useEffect(() => {
    if (!paymentCenterId && selectedCenter?.id) {
      setPaymentCenterId(selectedCenter.id);
    }
  }, [selectedCenter?.id, paymentCenterId]);

  const effectivePaymentCenterId = isAdmin
    ? (paymentCenterId || selectedCenter?.id || "")
    : (selectedCenter?.id || "");

  // Handle Toss payment redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get("payment");
    if (paymentStatus === "success") {
      const paymentKey = params.get("paymentKey");
      const orderId = params.get("orderId");
      const amount = parseInt(params.get("amount") || "0");
      if (paymentKey && orderId && amount && selectedCenter) {
        apiRequest("POST", "/api/payments/toss/confirm", {
          paymentKey,
          orderId,
          amount,
          centerId: selectedCenter.id,
        }).then(res => res.json()).then(data => {
          if (data.success) {
            toast({ title: `${amount.toLocaleString()}원이 충전되었습니다` });
            invalidateQueriesStartingWith("/api/sms-credits");
            invalidateQueriesStartingWith("/api/sms-credit-transactions");
          } else {
            toast({ title: data.error || "결제 승인에 실패했습니다.", variant: "destructive" });
          }
        }).catch(() => {
          toast({ title: "결제 처리 중 오류가 발생했습니다.", variant: "destructive" });
        });
        window.history.replaceState({}, "", "/settings");
        setActiveTab("sms");
      }
    } else if (paymentStatus === "fail") {
      const message = params.get("message");
      if (message) {
        toast({ title: decodeURIComponent(message), variant: "destructive" });
      }
      window.history.replaceState({}, "", "/settings");
      setActiveTab("sms");
    }
  }, [selectedCenter]);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch user's menu order
  const { data: savedMenuOrder } = useQuery<UserMenuOrder | null>({
    queryKey: [`/api/user-menu-order?userId=${user?.id}`],
    enabled: !!user?.id,
  });

  // Fetch features to include optional features in menu ordering
  const { data: features = [] } = useQuery<Feature[]>({
    queryKey: ["/api/features"],
  });

  // Fetch center features to know which are enabled
  const { data: centerFeatures = [] } = useQuery<CenterFeature[]>({
    queryKey: ["/api/center-features", selectedCenter?.id],
    enabled: !!selectedCenter?.id,
  });

  // Get enabled feature IDs for the current center
  // If a record exists in center_features, the feature is enabled
  const enabledFeatureIds = centerFeatures.map(cf => cf.featureId);

  const hiddenFeatureIds = useMemo(() => {
    return new Set(centerFeatures.filter(cf => cf.isHidden).map(cf => cf.featureId));
  }, [centerFeatures]);

  const parentGroupKeys = ["class-management", "schedule", "student-management", "parent-portal"];

  const subMenusByParent = useMemo(() => {
    const map: Record<string, SubMenuItem[]> = {};
    for (const parentKey of parentGroupKeys) {
      const children = features
        .filter(f => f.parentMenuKey === parentKey)
        .filter(f => {
          if (f.featureType === "optional") {
            return (user?.role ?? 0) >= UserRole.ADMIN || enabledFeatureIds.includes(f.id);
          }
          return true;
        })
        .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
        .map(f => ({
          menuKey: f.menuKey,
          name: f.name,
          featureId: f.id,
          isHidden: hiddenFeatureIds.has(f.id),
        }));
      if (children.length > 0) {
        const savedOrder = subMenuOrderState[parentKey];
        if (savedOrder && savedOrder.length > 0) {
          const reordered = savedOrder
            .map(key => children.find(c => c.menuKey === key))
            .filter(Boolean) as SubMenuItem[];
          const missing = children.filter(c => !savedOrder.includes(c.menuKey));
          map[parentKey] = [...reordered, ...missing];
        } else {
          map[parentKey] = children;
        }
      }
    }
    return map;
  }, [features, enabledFeatureIds, hiddenFeatureIds, user?.role, subMenuOrderState]);

  const featureByMenuKey = useMemo(() => {
    const map: Record<string, { id: string; isHidden: boolean }> = {};
    for (const f of features) {
      const cf = centerFeatures.find(c => c.featureId === f.id);
      map[f.menuKey] = { id: f.id, isHidden: cf ? !!cf.isHidden : false };
    }
    return map;
  }, [features, centerFeatures]);

  const toggleHiddenMutation = useMutation({
    mutationFn: async ({ featureId, isHidden }: { featureId: string; isHidden: boolean }) => {
      return apiRequest("PATCH", `/api/center-features/${selectedCenter?.id}/${featureId}/toggle-hidden?actorId=${user?.id}`, { isHidden });
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/center-features");
    },
    onError: () => {
      toast({ title: "메뉴 표시 설정 변경에 실패했습니다", variant: "destructive" });
    },
  });

  const handleToggleHidden = (featureId: string, isHidden: boolean) => {
    toggleHiddenMutation.mutate({ featureId, isHidden }, {
      onSuccess: () => { toast({ title: "메뉴 표시 설정이 변경되었습니다" }); }
    });
  };

  const handleToggleParentHidden = async (parentMenuKey: string, isHidden: boolean) => {
    const children = subMenusByParent[parentMenuKey] || [];
    try {
      await Promise.all(
        children.map(child =>
          apiRequest("PATCH", `/api/center-features/${selectedCenter?.id}/${child.featureId}/toggle-hidden?actorId=${user?.id}`, { isHidden })
        )
      );
      invalidateQueriesStartingWith("/api/center-features");
      toast({ title: isHidden ? "그룹 메뉴가 숨겨졌습니다" : "그룹 메뉴가 표시됩니다" });
    } catch {
      toast({ title: "메뉴 표시 설정 변경에 실패했습니다", variant: "destructive" });
    }
  };

  // Build optional feature menu items that are enabled for this center
  const getOptionalFeatureMenuItems = (): { id: string; title: string }[] => {
    const optionalFeatures = features.filter(f => f.featureType === "optional");
    // Admin sees all optional features, others see only enabled ones
    const visibleFeatures = (user?.role ?? 0) >= UserRole.ADMIN
      ? optionalFeatures
      : optionalFeatures.filter(f => enabledFeatureIds.includes(f.id));
    
    // Only include top-level features (no parentMenuKey or parentMenuKey is null)
    // Features with parentMenuKey are submenus and handled differently
    return visibleFeatures
      .filter(f => !f.parentMenuKey || f.parentMenuKey === "top-level")
      .map(f => ({
        id: f.menuKey || f.id.toString(),
        title: f.name,
      }));
  };

  // Initialize menu items
  useEffect(() => {
    if (user?.role !== undefined) {
      const defaultItems = getDefaultMenuItems(user.role);
      const optionalItems = getOptionalFeatureMenuItems();
      
      const allItems = [...defaultItems, ...optionalItems];
      
      if (savedMenuOrder?.menuOrder) {
        try {
          const savedOrder = JSON.parse(savedMenuOrder.menuOrder) as string[];
          const reorderedItems = savedOrder
            .map(id => allItems.find(item => item.id === id))
            .filter(Boolean) as { id: string; title: string }[];
          const missingItems = allItems.filter(
            item => !savedOrder.includes(item.id)
          );
          setMenuItems([...reorderedItems, ...missingItems]);
        } catch {
          setMenuItems(allItems);
        }
      } else {
        setMenuItems(allItems);
      }

      if (savedMenuOrder?.subMenuOrder) {
        try {
          setSubMenuOrderState(JSON.parse(savedMenuOrder.subMenuOrder));
        } catch {
          setSubMenuOrderState({});
        }
      }
    }
  }, [user?.role, savedMenuOrder, features, centerFeatures, selectedCenter?.id]);

  // Save menu order mutation
  const saveMenuOrderMutation = useMutation({
    mutationFn: async ({ order, subOrder }: { order: string[]; subOrder: Record<string, string[]> }) => {
      return apiRequest("POST", `/api/user-menu-order?userId=${user?.id}`, { menuOrder: order, subMenuOrder: subOrder });
    },
    onSuccess: () => {
      toast({ title: "메뉴 순서가 저장되었습니다" });
      setHasMenuChanges(false);
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("/api/user-menu-order");
        }
      });
    },
    onError: () => {
      toast({ title: "메뉴 순서 저장에 실패했습니다", variant: "destructive" });
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = menuItems.findIndex((item) => item.id === active.id);
      const newIndex = menuItems.findIndex((item) => item.id === over.id);
      const newOrder = arrayMove(menuItems, oldIndex, newIndex);
      setMenuItems(newOrder);
      setHasMenuChanges(true);
    }
  };

  const handleSaveMenuOrder = () => {
    saveMenuOrderMutation.mutate({ order: menuItems.map(item => item.id), subOrder: subMenuOrderState });
  };

  const handleSubItemReorder = (parentKey: string, newOrder: string[]) => {
    setSubMenuOrderState(prev => ({ ...prev, [parentKey]: newOrder }));
    setHasMenuChanges(true);
  };

  const handleResetMenuOrder = () => {
    if (user?.role !== undefined) {
      const defaultItems = getDefaultMenuItems(user.role);
      const optionalItems = getOptionalFeatureMenuItems();
      const allItems = [...defaultItems, ...optionalItems];
      setMenuItems(allItems);
      setSubMenuOrderState({});
      setHasMenuChanges(true);
    }
  };

  // Fetch existing teacher check-in settings
  const { data: checkInSettings, isLoading: isLoadingSettings } = useQuery<{
    id: string;
    checkInCode: string;
    smsRecipient1: string | null;
    smsRecipient2: string | null;
    messageTemplate: string | null;
    checkOutMessageTemplate: string | null;
    isActive: boolean;
  } | null>({
    queryKey: [`/api/teacher-check-in-settings?teacherId=${user?.id}&centerId=${selectedCenter?.id}`],
    enabled: !!user?.id && !!selectedCenter?.id && isAdminOrPrincipal,
  });

  // Populate form with existing settings when data loads
  useEffect(() => {
    if (checkInSettings) {
      setSmsRecipient1(checkInSettings.smsRecipient1 || "");
      setSmsRecipient2(checkInSettings.smsRecipient2 || "");
      setMessageTemplate(checkInSettings.messageTemplate || "");
      setCheckOutMsgTemplate(checkInSettings.checkOutMessageTemplate || "");
      setIsCheckInActive(checkInSettings.isActive ?? true);
    }
  }, [checkInSettings]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { name: string; phone: string }) => {
      return apiRequest("PATCH", `/api/users/${user?.id}`, data);
    },
    onSuccess: () => {
      toast({ title: "프로필이 수정되었습니다. 다시 로그인하시면 변경사항이 반영됩니다." });
      setIsEditingProfile(false);
      invalidateQueriesStartingWith("/api/users");
    },
    onError: () => {
      toast({ title: "프로필 수정에 실패했습니다", variant: "destructive" });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/users/change-password", data);
    },
    onSuccess: () => {
      toast({ title: "비밀번호가 변경되었습니다" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: () => {
      toast({ title: "비밀번호 변경에 실패했습니다", variant: "destructive" });
    },
  });

  const saveCheckInSettingsMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/teacher-check-in-settings", data);
    },
    onSuccess: () => {
      toast({ title: "출근 설정이 저장되었습니다" });
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("/api/teacher-check-in-settings");
        }
      });
    },
    onError: (error: any) => {
      const message = error?.message || "출근 설정 저장에 실패했습니다";
      toast({ title: message, variant: "destructive" });
    },
  });

  const handleCheckInSettingsSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveCheckInSettingsMutation.mutate({
      teacherId: user?.id,
      centerId: selectedCenter?.id,
      smsRecipient1: smsRecipient1 || null,
      smsRecipient2: smsRecipient2 || null,
      messageTemplate: messageTemplate || null,
      checkOutMessageTemplate: checkOutMsgTemplate || null,
      isActive: isCheckInActive,
    });
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "새 비밀번호가 일치하지 않습니다", variant: "destructive" });
      return;
    }
    changePasswordMutation.mutate({
      userId: user?.id,
      currentPassword,
      newPassword,
    });
  };

  // ===== SMS Tab queries and mutations =====
  
  // Message templates query
  const { data: templates = [] } = useQuery<MessageTemplate[]>({
    queryKey: [`/api/message-templates?centerId=${selectedCenter?.id}`],
    enabled: !!selectedCenter?.id && isAdminOrPrincipal,
  });
  
  // Populate message templates
  useEffect(() => {
    const checkInTemplate = templates.find(t => t.type === "check_in");
    const lateTemplate = templates.find(t => t.type === "late");
    const checkOutTemplate = templates.find(t => t.type === "check_out");
    if (checkInTemplate) setCheckInMessage(checkInTemplate.body);
    if (lateTemplate) setLateMessage(lateTemplate.body);
    if (checkOutTemplate) setCheckOutMessage(checkOutTemplate.body);
  }, [templates]);
  
  // Save message templates mutation
  const saveTemplatesMutation = useMutation({
    mutationFn: async () => {
      const checkInTemplate = templates.find(t => t.type === "check_in");
      const lateTemplate = templates.find(t => t.type === "late");
      const checkOutTemplate = templates.find(t => t.type === "check_out");
      
      const requests = [];
      if (checkInTemplate) {
        requests.push(apiRequest("PATCH", `/api/message-templates/${checkInTemplate.id}`, {
          body: checkInMessage,
        }));
      } else {
        requests.push(apiRequest("POST", "/api/message-templates", {
          centerId: selectedCenter?.id,
          type: "check_in",
          title: "등원 알림",
          body: checkInMessage,
        }));
      }
      if (lateTemplate) {
        requests.push(apiRequest("PATCH", `/api/message-templates/${lateTemplate.id}`, {
          body: lateMessage,
        }));
      } else {
        requests.push(apiRequest("POST", "/api/message-templates", {
          centerId: selectedCenter?.id,
          type: "late",
          title: "지각 알림",
          body: lateMessage,
        }));
      }
      if (checkOutTemplate) {
        requests.push(apiRequest("PATCH", `/api/message-templates/${checkOutTemplate.id}`, {
          body: checkOutMessage,
        }));
      } else {
        requests.push(apiRequest("POST", "/api/message-templates", {
          centerId: selectedCenter?.id,
          type: "check_out",
          title: "하원 알림",
          body: checkOutMessage,
        }));
      }
      return Promise.all(requests);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/message-templates");
      toast({ title: "메시지 템플릿이 저장되었습니다" });
    },
    onError: () => {
      toast({ title: "저장에 실패했습니다", variant: "destructive" });
    },
  });

  // Teacher check-in settings list for message template
  const { data: teacherCheckInSettingsList = [] } = useQuery<TeacherCheckInSettings[]>({
    queryKey: [`/api/teacher-check-in-settings/all?centerId=${selectedCenter?.id}`],
    enabled: !!selectedCenter?.id && isAdminOrPrincipal,
  });

  // Load system-level teacher message templates as fallback
  const { data: teacherMessageSystemSetting } = useQuery<{ value: string } | null>({
    queryKey: [`/api/system-settings/teacher_message_template_${selectedCenter?.id}`],
    enabled: !!selectedCenter?.id && isAdminOrPrincipal,
  });

  // Load teacher check-in/check-out message templates from first settings or system setting
  useEffect(() => {
    let loadedCheckIn = false;
    let loadedCheckOut = false;
    if (teacherCheckInSettingsList.length > 0) {
      const firstWithTemplate = teacherCheckInSettingsList.find((s) => s.messageTemplate);
      if (firstWithTemplate?.messageTemplate) {
        setTeacherCheckInMessage(firstWithTemplate.messageTemplate);
        loadedCheckIn = true;
      }
      const firstWithCheckOutTemplate = teacherCheckInSettingsList.find((s) => s.checkOutMessageTemplate);
      if (firstWithCheckOutTemplate?.checkOutMessageTemplate) {
        setTeacherCheckOutMessage(firstWithCheckOutTemplate.checkOutMessageTemplate);
        loadedCheckOut = true;
      }
    }
    if ((!loadedCheckIn || !loadedCheckOut) && teacherMessageSystemSetting?.value) {
      try {
        const parsed = JSON.parse(teacherMessageSystemSetting.value);
        if (!loadedCheckIn && parsed.messageTemplate) setTeacherCheckInMessage(parsed.messageTemplate);
        if (!loadedCheckOut && parsed.checkOutMessageTemplate) setTeacherCheckOutMessage(parsed.checkOutMessageTemplate);
      } catch {}
    }
  }, [teacherCheckInSettingsList, teacherMessageSystemSetting]);

  // Save teacher check-in/check-out message templates
  const saveTeacherMessageMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/teacher-check-in-settings/update-message-template", {
        centerId: selectedCenter?.id,
        messageTemplate: teacherCheckInMessage,
        checkOutMessageTemplate: teacherCheckOutMessage,
      });
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/teacher-check-in-settings");
      toast({ title: "출퇴근 알림 메시지가 저장되었습니다" });
    },
    onError: () => {
      toast({ title: "저장에 실패했습니다", variant: "destructive" });
    },
  });

  // SOLAPI credentials query (for Principal)
  const { data: solapiCredentials, isLoading: solapiLoading } = useQuery<{
    hasCredentials: boolean;
    senderNumber?: string;
    updatedAt?: string;
    apiKeyMasked?: string;
    apiSecretMasked?: string;
  }>({
    queryKey: [`/api/centers/${selectedCenter?.id}/solapi`],
    enabled: !!selectedCenter?.id && isAdminOrPrincipal,
  });

  const { data: freshCenterData } = useQuery<Center>({
    queryKey: ["/api/centers", selectedCenter?.id, "fresh"],
    queryFn: async () => {
      const res = await fetch("/api/centers");
      const centers: Center[] = await res.json();
      return centers.find(c => c.id === selectedCenter?.id) || null;
    },
    enabled: !!selectedCenter?.id && isAdminOrPrincipal,
  });

  // Save SOLAPI settings mutation
  const saveSolapiMutation = useMutation({
    mutationFn: async (data: { apiKey: string; apiSecret: string; senderNumber: string }) => {
      return apiRequest("PUT", `/api/centers/${selectedCenter?.id}/solapi`, data);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith(`/api/centers/${selectedCenter?.id}/solapi`);
      toast({ title: "SOLAPI 설정이 저장되었습니다" });
      setSolapiApiKey("");
      setSolapiApiSecret("");
      setSolapiSenderNumber("");
      setRevealedCredentials(null);
      setShowSavedApiKey(false);
      setShowSavedApiSecret(false);
    },
    onError: () => {
      toast({ title: "SOLAPI 설정 저장에 실패했습니다", variant: "destructive" });
    },
  });

  const handleSolapiSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!solapiApiKey || !solapiApiSecret || !solapiSenderNumber) {
      toast({ title: "모든 필드를 입력해주세요", variant: "destructive" });
      return;
    }
    saveSolapiMutation.mutate({
      apiKey: solapiApiKey,
      apiSecret: solapiApiSecret,
      senderNumber: solapiSenderNumber,
    });
  };

  const handleRevealCredentials = async () => {
    if (!selectedCenter?.id || !user?.id) return;
    try {
      const response = await fetch(`/api/centers/${selectedCenter.id}/solapi/reveal?actorId=${user.id}`);
      if (response.ok) {
        const data = await response.json();
        setRevealedCredentials(data);
      } else {
        toast({ title: "자격 증명을 가져올 수 없습니다", variant: "destructive" });
      }
    } catch {
      toast({ title: "자격 증명을 가져올 수 없습니다", variant: "destructive" });
    }
  };

  const toggleShowSavedApiKey = () => {
    if (!showSavedApiKey && !revealedCredentials) {
      handleRevealCredentials();
    }
    setShowSavedApiKey(!showSavedApiKey);
  };

  const toggleShowSavedApiSecret = () => {
    if (!showSavedApiSecret && !revealedCredentials) {
      handleRevealCredentials();
    }
    setShowSavedApiSecret(!showSavedApiSecret);
  };

  // System default Toss Payments settings (admin only)
  const { data: defaultTossSettings, isLoading: defaultTossLoading } = useQuery<{
    configured: boolean;
    hasClientKey: boolean;
    hasSecretKey: boolean;
    maskedClientKey: string | null;
    maskedSecretKey: string | null;
  }>({
    queryKey: ["/api/admin/default-toss-settings"],
    enabled: isAdmin,
  });

  const saveDefaultTossMutation = useMutation({
    mutationFn: async (data: { clientKey: string; secretKey: string }) => {
      return apiRequest("PUT", `/api/admin/default-toss-settings?actorId=${user?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/default-toss-settings"] });
      toast({ title: "기본 토스페이먼츠 설정이 저장되었습니다" });
      setDefaultTossClientKey("");
      setDefaultTossSecretKey("");
    },
    onError: () => {
      toast({ title: "기본 토스페이먼츠 설정 저장에 실패했습니다", variant: "destructive" });
    },
  });

  const deleteDefaultTossMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/admin/default-toss-settings?actorId=${user?.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/default-toss-settings"] });
      toast({ title: "기본 토스페이먼츠 설정이 삭제되었습니다" });
    },
    onError: () => {
      toast({ title: "기본 토스페이먼츠 설정 삭제에 실패했습니다", variant: "destructive" });
    },
  });

  const handleDefaultTossSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!defaultTossClientKey || !defaultTossSecretKey) {
      toast({ title: "모든 필드를 입력해주세요", variant: "destructive" });
      return;
    }
    saveDefaultTossMutation.mutate({
      clientKey: defaultTossClientKey,
      secretKey: defaultTossSecretKey,
    });
  };

  // Toss Payments settings query
  const { data: tossSettings, isLoading: tossLoading } = useQuery<{
    configured: boolean;
    hasClientKey: boolean;
    hasSecretKey: boolean;
    maskedClientKey: string | null;
    maskedSecretKey: string | null;
  }>({
    queryKey: [`/api/centers/${effectivePaymentCenterId}/toss-settings`],
    enabled: !!effectivePaymentCenterId && isAdminOrPrincipal,
  });

  // Save Toss Payments settings mutation
  const saveTossMutation = useMutation({
    mutationFn: async (data: { clientKey: string; secretKey: string }) => {
      return apiRequest("PUT", `/api/centers/${effectivePaymentCenterId}/toss-settings?actorId=${user?.id}`, data);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith(`/api/centers/${effectivePaymentCenterId}/toss-settings`);
      toast({ title: "토스페이먼츠 설정이 저장되었습니다" });
      setTossClientKey("");
      setTossSecretKey("");
    },
    onError: () => {
      toast({ title: "토스페이먼츠 설정 저장에 실패했습니다", variant: "destructive" });
    },
  });

  // Delete Toss Payments settings mutation
  const deleteTossMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/centers/${effectivePaymentCenterId}/toss-settings?actorId=${user?.id}`);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith(`/api/centers/${effectivePaymentCenterId}/toss-settings`);
      toast({ title: "토스페이먼츠 설정이 삭제되었습니다" });
    },
    onError: () => {
      toast({ title: "토스페이먼츠 설정 삭제에 실패했습니다", variant: "destructive" });
    },
  });

  const handleTossSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tossClientKey || !tossSecretKey) {
      toast({ title: "모든 필드를 입력해주세요", variant: "destructive" });
      return;
    }
    saveTossMutation.mutate({
      clientKey: tossClientKey,
      secretKey: tossSecretKey,
    });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">설정</h1>
        <p className="text-muted-foreground">계정 및 앱 설정</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={`grid w-full ${user?.role === 4 ? "grid-cols-2" : "grid-cols-1"}`}>
          <TabsTrigger value="general" data-testid="tab-general">일반</TabsTrigger>
          {user?.role === 4 && (
            <TabsTrigger value="charge" data-testid="tab-charge">충전</TabsTrigger>
          )}
        </TabsList>

        {/* 일반 탭 */}
        <TabsContent value="general" className="space-y-6 mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                내 정보
              </CardTitle>
              {!isEditingProfile && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    setProfileName(user?.name || "");
                    setProfilePhone(user?.phone || user?.username || "");
                    setIsEditingProfile(true);
                  }}
                  data-testid="button-edit-profile"
                >
                  수정
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditingProfile ? (
                <form onSubmit={(e) => {
                  e.preventDefault();
                  if (!profileName.trim()) {
                    toast({ title: "이름을 입력해주세요", variant: "destructive" });
                    return;
                  }
                  updateProfileMutation.mutate({ name: profileName.trim(), phone: profilePhone.trim() });
                }} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="profile-name">이름</Label>
                    <Input
                      id="profile-name"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      placeholder="이름을 입력하세요"
                      data-testid="input-profile-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profile-phone">전화번호</Label>
                    <Input
                      id="profile-phone"
                      value={profilePhone}
                      onChange={(e) => setProfilePhone(e.target.value)}
                      placeholder="010-1234-5678"
                      data-testid="input-profile-phone"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={updateProfileMutation.isPending} data-testid="button-save-profile">
                      {updateProfileMutation.isPending ? "저장 중..." : "저장"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setIsEditingProfile(false)} data-testid="button-cancel-profile">
                      취소
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="text-muted-foreground">이름</Label>
                    <p className="font-medium" data-testid="text-user-name">{user?.name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">아이디 (휴대폰)</Label>
                    <p className="font-medium" data-testid="text-user-phone">{user?.username}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                전자정보 이용 동의
              </CardTitle>
              <CardDescription>개인정보 수집 및 이용 동의 현황</CardDescription>
            </CardHeader>
            <CardContent>
              {user?.consentAgreedAt ? (
                <div className="flex items-center gap-3 p-4 bg-muted rounded-lg border">
                  <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0" />
                  <div>
                    <p className="font-medium" data-testid="text-consent-status">동의 완료</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(user.consentAgreedAt).toLocaleDateString("ko-KR", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}에 동의하셨습니다
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <Shield className="h-6 w-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-yellow-800 dark:text-yellow-200" data-testid="text-consent-status">동의 필요</p>
                    <p className="text-sm text-yellow-600 dark:text-yellow-400">서비스 이용을 위해 전자정보 이용에 동의해주세요</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {sidebarPosition === "left" ? <PanelLeft className="h-5 w-5" /> : <PanelRight className="h-5 w-5" />}
                사이드바 위치
              </CardTitle>
              <CardDescription>사이드바를 왼쪽 또는 오른쪽에 표시합니다</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button
                  variant={sidebarPosition === "left" ? "default" : "outline"}
                  onClick={() => setSidebarPosition("left")}
                  className="flex items-center gap-2"
                  data-testid="button-sidebar-left"
                >
                  <PanelLeft className="h-4 w-4" />
                  왼쪽
                </Button>
                <Button
                  variant={sidebarPosition === "right" ? "default" : "outline"}
                  onClick={() => setSidebarPosition("right")}
                  className="flex items-center gap-2"
                  data-testid="button-sidebar-right"
                >
                  <PanelRight className="h-4 w-4" />
                  오른쪽
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Menu className="h-5 w-5" />
                메뉴 순서
              </CardTitle>
              <CardDescription>드래그하여 메뉴 순서를 변경하고, 눈 아이콘으로 메뉴를 숨길 수 있습니다. 그룹 메뉴를 클릭하면 하위 메뉴가 펼쳐집니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={menuItems.map(item => item.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {menuItems.map((item) => {
                      const isParentGroup = parentGroupKeys.includes(item.id);
                      const subItems = isParentGroup ? subMenusByParent[item.id] : undefined;
                      const featureInfo = featureByMenuKey[item.id];
                      const allChildrenHidden = isParentGroup && subItems?.every(s => s.isHidden);
                      return (
                        <SortableMenuItem
                          key={item.id}
                          id={item.id}
                          title={item.title}
                          subItems={subItems}
                          isHidden={isParentGroup ? allChildrenHidden : featureInfo?.isHidden}
                          featureId={isParentGroup ? item.id : featureInfo?.id}
                          isAdminOrPrincipal={isAdminOrPrincipal}
                          onToggleHidden={isParentGroup
                            ? (_fId, hide) => handleToggleParentHidden(item.id, hide)
                            : featureInfo ? handleToggleHidden : undefined}
                          onToggleSubItemHidden={handleToggleHidden}
                          onSubItemReorder={handleSubItemReorder}
                        />
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>
              <div className="flex gap-2">
                <Button
                  onClick={handleSaveMenuOrder}
                  disabled={!hasMenuChanges || saveMenuOrderMutation.isPending}
                  data-testid="button-save-menu-order"
                >
                  {saveMenuOrderMutation.isPending ? "저장 중..." : "순서 저장"}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleResetMenuOrder}
                  data-testid="button-reset-menu-order"
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  기본값으로 복원
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                비밀번호 변경
              </CardTitle>
              <CardDescription>보안을 위해 주기적으로 비밀번호를 변경해주세요</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">현재 비밀번호</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    data-testid="input-current-password"
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="newPassword">새 비밀번호</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    data-testid="input-new-password"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">새 비밀번호 확인</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    data-testid="input-confirm-password"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={changePasswordMutation.isPending}
                  data-testid="button-change-password"
                >
                  {changePasswordMutation.isPending ? "변경 중..." : "비밀번호 변경"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {isAdmin && (
            <LogoHelpImageManager userId={user?.id} />
          )}

          {/* 웹 푸시 알림 설정 - 모든 사용자 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                푸시 알림
              </CardTitle>
              <CardDescription>
                앱을 사용하지 않을 때도 새 알림(출결, 숙제, 평가 등)을 핸드폰으로 받을 수 있습니다
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PushNotificationSettings />
            </CardContent>
          </Card>

          {isAdmin && (
            <InstallGuideAdminSettings />
          )}

          {isPrincipal && selectedCenter && (
            <CenterLogoManager userId={user?.id} center={selectedCenter} refreshCenters={refreshCenters} />
          )}

        </TabsContent>

        {/* 문자 탭 - 원장/관리자만 */}
        {isAdminOrPrincipal && (
          <TabsContent value="sms" className="space-y-6 mt-6">
            {/* SMS 연결 가이드 관리 - 관리자만 */}
            {isAdmin && (
              <>
                <SmsSetupGuideManager userId={user?.id} />
                <SolapiManualManager userId={user?.id} />
              </>
            )}

            {/* SOLAPI 설정 - 원장/관리자 */}
            {isAdminOrPrincipal && selectedCenter && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    문자 연결
                  </CardTitle>
                  <CardDescription>
                    SMS/카카오톡 알림 발송을 위한 SOLAPI 설정
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {solapiLoading || !freshCenterData ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : (freshCenterData as any)?.smsMode === "credit" ? (
                    <SmsCreditSetup
                      centerId={selectedCenter.id}
                      onComplete={() => {
                        invalidateQueriesStartingWith(`/api/centers`);
                      }}
                    />
                  ) : solapiCredentials?.hasCredentials ? (
                    <DirectSmsWithCreditSwitch
                      centerId={selectedCenter.id}
                      userId={user?.id || ""}
                      onCreditComplete={() => {
                        invalidateQueriesStartingWith(`/api/centers`);
                      }}
                    />
                  ) : (
                    <SmsConnectionWizard
                      centerId={selectedCenter.id}
                      userId={user?.id || ""}
                      onComplete={() => {
                        invalidateQueriesStartingWith(`/api/centers/${selectedCenter.id}/solapi`);
                        invalidateQueriesStartingWith(`/api/centers`);
                      }}
                    />
                  )}
                </CardContent>
              </Card>
            )}

            {/* 출결 알림 메시지 설정 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  출결 알림 메시지 설정
                </CardTitle>
                <CardDescription>
                  등원/지각/하원 시 학부모에게 발송되는 카카오톡/SMS 메시지 내용을 설정합니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>등원 알림 메시지</Label>
                  <Textarea
                    value={checkInMessage}
                    onChange={(e) => setCheckInMessage(e.target.value)}
                    className="min-h-[80px]"
                    data-testid="input-checkin-message"
                  />
                  <p className="text-xs text-muted-foreground">
                    사용 가능한 변수: {"{학원명}"}, {"{학생명}"}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>지각 알림 메시지</Label>
                  <Textarea
                    value={lateMessage}
                    onChange={(e) => setLateMessage(e.target.value)}
                    className="min-h-[80px]"
                    data-testid="input-late-message"
                  />
                  <p className="text-xs text-muted-foreground">
                    사용 가능한 변수: {"{학원명}"}, {"{학생명}"}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>하원 알림 메시지</Label>
                  <Textarea
                    value={checkOutMessage}
                    onChange={(e) => setCheckOutMessage(e.target.value)}
                    className="min-h-[80px]"
                    data-testid="input-checkout-message"
                  />
                  <p className="text-xs text-muted-foreground">
                    사용 가능한 변수: {"{학원명}"}, {"{학생명}"}
                  </p>
                </div>
                <Button 
                  onClick={() => saveTemplatesMutation.mutate()}
                  disabled={saveTemplatesMutation.isPending}
                  data-testid="button-save-messages"
                >
                  {saveTemplatesMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  저장
                </Button>
              </CardContent>
            </Card>

            {/* 선생님 출퇴근 알림 메시지 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <GraduationCap className="w-5 h-5" />
                  선생님 출퇴근 알림 메시지
                </CardTitle>
                <CardDescription>
                  선생님 출근/퇴근 시 원장님에게 발송되는 SMS 메시지 내용을 설정합니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>출근 문자 서식</Label>
                  <Textarea
                    value={teacherCheckInMessage}
                    onChange={(e) => setTeacherCheckInMessage(e.target.value)}
                    className="min-h-[70px]"
                    placeholder="[{센터명}] {선생님명} 선생님 출근 확인"
                    data-testid="input-teacher-checkin-message"
                  />
                </div>
                <div className="space-y-2">
                  <Label>퇴근 문자 서식</Label>
                  <Textarea
                    value={teacherCheckOutMessage}
                    onChange={(e) => setTeacherCheckOutMessage(e.target.value)}
                    className="min-h-[70px]"
                    placeholder="[{센터명}] {선생님명} 선생님 퇴근 확인"
                    data-testid="input-teacher-checkout-message"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  사용 가능한 변수: {"{센터명}"}, {"{선생님명}"}, {"{시간}"}, {"{날짜}"}
                </p>
                <Button
                  onClick={() => saveTeacherMessageMutation.mutate()}
                  disabled={saveTeacherMessageMutation.isPending}
                  data-testid="button-save-teacher-message"
                >
                  {saveTeacherMessageMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  저장
                </Button>
              </CardContent>
            </Card>

            {/* 출퇴근 알림 설정 (내 출근코드) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  출퇴근 알림 설정
                </CardTitle>
                <CardDescription>
                  출퇴근 시 SMS 알림을 받을 수신자와 문자 서식을 설정합니다
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCheckInSettingsSave} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>출근 알림 활성화</Label>
                      <p className="text-sm text-muted-foreground">
                        출근 시 SMS 알림을 받습니다
                      </p>
                    </div>
                    <Switch
                      checked={isCheckInActive}
                      onCheckedChange={setIsCheckInActive}
                      data-testid="switch-check-in-active"
                    />
                  </div>

                  <Separator />

                  <div className="p-3 bg-muted rounded-md">
                    <p className="text-sm text-muted-foreground">
                      출근코드는 핸드폰번호 뒷 4자리로 자동 설정됩니다. 다른 선생님과 중복되는 경우 가운데 4자리가 사용됩니다.
                    </p>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor="smsRecipient1">
                      <MessageSquare className="inline-block h-4 w-4 mr-1" />
                      SMS 수신자 1
                    </Label>
                    <Input
                      id="smsRecipient1"
                      type="tel"
                      placeholder="010-1234-5678"
                      value={smsRecipient1}
                      onChange={(e) => setSmsRecipient1(e.target.value)}
                      data-testid="input-sms-recipient-1"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="smsRecipient2">SMS 수신자 2 (선택사항)</Label>
                    <Input
                      id="smsRecipient2"
                      type="tel"
                      placeholder="010-1234-5678"
                      value={smsRecipient2}
                      onChange={(e) => setSmsRecipient2(e.target.value)}
                      data-testid="input-sms-recipient-2"
                    />
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor="messageTemplate">
                      출근 문자 서식
                    </Label>
                    <Textarea
                      id="messageTemplate"
                      placeholder="[{학원명}] {name} 선생님이 출근하셨습니다. ({시간})"
                      value={messageTemplate}
                      onChange={(e) => setMessageTemplate(e.target.value)}
                      rows={2}
                      data-testid="input-message-template"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="checkOutMessageTemplate">
                      퇴근 문자 서식
                    </Label>
                    <Textarea
                      id="checkOutMessageTemplate"
                      placeholder="[{학원명}] {name} 선생님이 퇴근하셨습니다. ({시간})"
                      value={checkOutMsgTemplate}
                      onChange={(e) => setCheckOutMsgTemplate(e.target.value)}
                      rows={2}
                      data-testid="input-checkout-message-template"
                    />
                  </div>

                  <p className="text-xs text-muted-foreground">
                    사용 가능한 변수: {"{name}"} 또는 {"{선생님명}"} (이름), {"{학원명}"} (학원명), {"{시간}"}, {"{날짜}"}
                  </p>

                  <Button
                    type="submit"
                    disabled={saveCheckInSettingsMutation.isPending || isLoadingSettings}
                    data-testid="button-save-check-in-settings"
                  >
                    {saveCheckInSettingsMutation.isPending ? "저장 중..." : "설정 저장"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* 충전 탭 - 관리자 전용 충전용 토스 키 */}
        {user?.role === 4 && (
          <TabsContent value="charge" className="space-y-6 mt-6">
            <ChargeTossSettings userId={user?.id || ""} userRole={user?.role || 0} />
          </TabsContent>
        )}

        {/* 결제 탭 */}
        {isAdminOrPrincipal && (
          <TabsContent value="payment" className="space-y-6 mt-6">
            {isAdmin && (
              <Card data-testid="card-default-toss-settings">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    기본 토스페이먼츠 키 (시스템 전체 기본값)
                  </CardTitle>
                  <CardDescription>
                    학원별 키가 따로 등록되지 않은 경우 이 기본 키가 사용됩니다. 관리자만 설정할 수 있습니다.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {defaultTossLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : defaultTossSettings?.configured ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                        <CheckCircle2 className="h-6 w-6 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="font-medium text-blue-800 dark:text-blue-200">기본 키 설정 완료</p>
                          <p className="text-sm text-blue-600 dark:text-blue-400">
                            클라이언트: {defaultTossSettings.maskedClientKey} / 시크릿: {defaultTossSettings.maskedSecretKey}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (confirm("정말 기본 토스페이먼츠 키를 삭제하시겠습니까?")) {
                              deleteDefaultTossMutation.mutate();
                            }
                          }}
                          disabled={deleteDefaultTossMutation.isPending}
                          data-testid="button-delete-default-toss"
                        >
                          {deleteDefaultTossMutation.isPending ? "삭제 중..." : "기본 키 삭제"}
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        기본 키를 변경하려면 아래에 새 키를 입력 후 저장하세요.
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
                      <Shield className="h-6 w-6 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-medium text-amber-800 dark:text-amber-200">기본 키 미설정</p>
                        <p className="text-sm text-amber-600 dark:text-amber-400">
                          기본 키를 설정하면 학원별 키가 없는 학원은 이 키로 결제됩니다.
                        </p>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleDefaultTossSave} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="default-toss-client-key">기본 클라이언트 키</Label>
                      <div className="relative">
                        <Input
                          id="default-toss-client-key"
                          type={showDefaultTossClientKey ? "text" : "password"}
                          value={defaultTossClientKey}
                          onChange={(e) => setDefaultTossClientKey(e.target.value)}
                          placeholder="test_ck_ 또는 live_ck_ 로 시작"
                          data-testid="input-default-toss-client-key"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowDefaultTossClientKey(!showDefaultTossClientKey)}
                        >
                          {showDefaultTossClientKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="default-toss-secret-key">기본 시크릿 키</Label>
                      <div className="relative">
                        <Input
                          id="default-toss-secret-key"
                          type={showDefaultTossSecretKey ? "text" : "password"}
                          value={defaultTossSecretKey}
                          onChange={(e) => setDefaultTossSecretKey(e.target.value)}
                          placeholder="test_sk_ 또는 live_sk_ 로 시작"
                          data-testid="input-default-toss-secret-key"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowDefaultTossSecretKey(!showDefaultTossSecretKey)}
                        >
                          {showDefaultTossSecretKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <Button
                      type="submit"
                      disabled={saveDefaultTossMutation.isPending || !defaultTossClientKey || !defaultTossSecretKey}
                      data-testid="button-save-default-toss"
                    >
                      {saveDefaultTossMutation.isPending ? "저장 중..." : "기본 키 저장"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  학원별 토스페이먼츠 키 (교육비 결제용)
                </CardTitle>
                <CardDescription>
                  학원별로 토스페이먼츠 API 키를 따로 설정합니다. 학원별 키가 없으면 위의 기본 키가 사용됩니다.
                  <a 
                    href="https://developers.tosspayments.com/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="ml-1 text-primary hover:underline inline-flex items-center gap-1"
                  >
                    개발자센터 <ExternalLink className="h-3 w-3" />
                  </a>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isAdmin && (allCentersForPayment?.length ?? 0) > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="payment-center-select">학원 선택</Label>
                    <Select
                      value={effectivePaymentCenterId}
                      onValueChange={(v) => setPaymentCenterId(v)}
                    >
                      <SelectTrigger id="payment-center-select" data-testid="select-payment-center">
                        <SelectValue placeholder="학원을 선택하세요" />
                      </SelectTrigger>
                      <SelectContent>
                        {allCentersForPayment?.map((c) => (
                          <SelectItem key={c.id} value={c.id} data-testid={`option-payment-center-${c.id}`}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      각 학원별로 토스페이먼츠 키를 따로 설정할 수 있습니다.
                    </p>
                  </div>
                )}
                {tossLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : tossSettings?.configured ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                      <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-medium text-green-800 dark:text-green-200">설정 완료</p>
                        <p className="text-sm text-green-600 dark:text-green-400">
                          토스페이먼츠 결제가 활성화되어 있습니다.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (confirm("정말 토스페이먼츠 설정을 삭제하시겠습니까?")) {
                            deleteTossMutation.mutate();
                          }
                        }}
                        disabled={deleteTossMutation.isPending}
                        data-testid="button-delete-toss"
                      >
                        {deleteTossMutation.isPending ? "삭제 중..." : "설정 삭제"}
                      </Button>
                    </div>
                    <SavedTossKeys
                      centerId={effectivePaymentCenterId}
                      maskedClientKey={tossSettings.maskedClientKey}
                      maskedSecretKey={tossSettings.maskedSecretKey}
                    />
                    <p className="text-sm text-muted-foreground">
                      키를 변경하려면 아래에 새 키를 입력 후 저장하세요.
                    </p>
                  </div>
                ) : null}

                <form onSubmit={handleTossSave} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="toss-client-key">클라이언트 키</Label>
                    <div className="relative">
                      <Input
                        id="toss-client-key"
                        type={showTossClientKey ? "text" : "password"}
                        value={tossClientKey}
                        onChange={(e) => setTossClientKey(e.target.value)}
                        placeholder="test_ck_ 또는 live_ck_ 로 시작"
                        data-testid="input-toss-client-key"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowTossClientKey(!showTossClientKey)}
                      >
                        {showTossClientKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      개발자센터 → 내 개발 정보 → API 키에서 확인
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="toss-secret-key">시크릿 키</Label>
                    <div className="relative">
                      <Input
                        id="toss-secret-key"
                        type={showTossSecretKey ? "text" : "password"}
                        value={tossSecretKey}
                        onChange={(e) => setTossSecretKey(e.target.value)}
                        placeholder="test_sk_ 또는 live_sk_ 로 시작"
                        data-testid="input-toss-secret-key"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowTossSecretKey(!showTossSecretKey)}
                      >
                        {showTossSecretKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      결제 승인에 사용되는 비밀 키입니다. 절대 외부에 노출하지 마세요.
                    </p>
                  </div>

                  <Button
                    type="submit"
                    disabled={saveTossMutation.isPending || !tossClientKey || !tossSecretKey}
                    data-testid="button-save-toss"
                  >
                    {saveTossMutation.isPending ? "저장 중..." : "설정 저장"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
