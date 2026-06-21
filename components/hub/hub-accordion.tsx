import Link from "next/link";
import { CheckCircle2, PlusCircle } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CATEGORIES, VENDOR_TYPES, type VendorType } from "@/lib/constants/categories";
import { type Vendor } from "@/lib/types";

interface VendorWithRecon extends Vendor {
  hasRecon: boolean;
}

interface HubAccordionProps {
  vendors: VendorWithRecon[];
}

export function HubAccordion({ vendors }: HubAccordionProps) {
  // Group vendors by type, preserving VENDOR_TYPES order.
  const grouped = VENDOR_TYPES.reduce<Record<VendorType, VendorWithRecon[]>>(
    (acc, type) => {
      acc[type] = vendors.filter((v) => v.vendor_type === type);
      return acc;
    },
    {} as Record<VendorType, VendorWithRecon[]>,
  );

  // Only render sections that have at least one vendor.
  const activeSections = VENDOR_TYPES.filter(
    (type) => grouped[type].length > 0,
  );

  // Default-open the first section.
  const defaultOpen = activeSections.length > 0 ? [activeSections[0]] : [];

  return (
    <Accordion
      defaultValue={defaultOpen}
      multiple
      className="divide-y divide-border"
    >
      {activeSections.map((type) => {
        const category = CATEGORIES[type];
        const Icon = category.icon;
        const sectionVendors = grouped[type];

        return (
          <AccordionItem key={type} value={type} className="border-none">
            <AccordionTrigger
              className="px-4 py-3 hover:no-underline"
              style={{ color: category.textHex }}
            >
              <span
                className="flex items-center gap-2 font-semibold text-sm"
              >
                <span
                  className="flex size-7 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: category.lightHex,
                    color: category.colorHex,
                  }}
                >
                  <Icon className="size-4" />
                </span>
                <span style={{ color: category.textHex }}>
                  {category.label}
                </span>
                <span
                  className="ml-1 rounded-full px-1.5 py-0.5 text-xs font-medium"
                  style={{
                    backgroundColor: category.lightHex,
                    color: category.textHex,
                  }}
                >
                  {sectionVendors.length}
                </span>
              </span>
            </AccordionTrigger>

            <AccordionContent className="px-0 pb-0">
              <ul className="divide-y divide-border">
                {sectionVendors.map((vendor) => (
                  <li
                    key={vendor.id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {vendor.name}
                      </p>
                      {vendor.city && (
                        <p className="truncate text-xs text-muted-foreground">
                          {vendor.city}
                          {vendor.region ? `, ${vendor.region}` : ""}
                        </p>
                      )}
                    </div>

                    {vendor.hasRecon ? (
                      <Badge
                        className="shrink-0 gap-1 border-transparent"
                        style={{
                          backgroundColor: "#E1F5EE",
                          color: "#085041",
                        }}
                      >
                        <CheckCircle2 className="size-3" />
                        Recon added
                      </Badge>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0 gap-1"
                        render={
                          <Link href={`/add?vendorId=${vendor.id}&vendorName=${encodeURIComponent(vendor.name)}`}>
                            <PlusCircle className="size-3.5" />
                            Add Recon
                          </Link>
                        }
                      />
                    )}
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
