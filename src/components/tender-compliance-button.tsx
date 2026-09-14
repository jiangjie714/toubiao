"use client";

import React, { useState } from "react";
import { ShieldCheckIcon } from "@/components/icons";
import TenderComplianceDialog from "./tender-compliance-dialog";

interface Props {
  tenderId: number;
}

export default function TenderComplianceButton({ tenderId }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50/70 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 hover:border-red-300 transition-colors print:hidden shadow-2xs"
        title="点击开启标书 16 项高频废标红线与一票否决合规体检"
      >
        <ShieldCheckIcon className="h-3.5 w-3.5 text-red-600" />
        <span>合规体检</span>
      </button>

      <TenderComplianceDialog
        tenderId={tenderId}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
