import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";
import type { Center } from "@shared/schema";

export function BusinessFooter() {
  const { selectedCenter } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const { data: centers } = useQuery<Center[]>({
    queryKey: ["/api/centers"],
  });

  const currentCenter = centers?.find(c => c.id === selectedCenter?.id);

  const businessInfo = currentCenter ? {
    representative: currentCenter.representativeName,
    name: currentCenter.businessName,
    registrationNumber: currentCenter.businessRegistrationNumber,
    address: currentCenter.businessAddress,
    phone: currentCenter.businessPhone,
  } : null;

  const hasAnyInfo = businessInfo && Object.values(businessInfo).some(v => v);

  if (!hasAnyInfo || !businessInfo) {
    return null;
  }

  const InfoContent = () => (
    <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
      {businessInfo.representative && (
        <div>대표자명: {businessInfo.representative}</div>
      )}
      {businessInfo.name && (
        <div>상호명: {businessInfo.name}</div>
      )}
      {businessInfo.registrationNumber && (
        <div>사업자등록번호: {businessInfo.registrationNumber}</div>
      )}
      {businessInfo.address && (
        <div>사업장주소: {businessInfo.address}</div>
      )}
      {businessInfo.phone && (
        <div>전화번호: {businessInfo.phone}</div>
      )}
    </div>
  );

  return (
    <div data-testid="business-footer">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="w-full py-2.5 px-4 flex items-center justify-center gap-2 text-xs text-muted-foreground hover-elevate transition-colors">
          <span>{currentCenter?.name} 사업자정보</span>
          <ChevronUp className={`h-3 w-3 transition-transform duration-200 ${isOpen ? "" : "rotate-180"}`} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-3 pt-1">
            <InfoContent />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
