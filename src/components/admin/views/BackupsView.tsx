// ============================================================================
// File: src/components/admin/views/BackupsView.tsx
// Purpose: Backup module placeholder. All backup management functionality has
//          been removed per Phase 41 requirements. This page now serves as a
//          clean placeholder for future backup system development.
//
//  What was removed:
//    - Database table statistics
//    - Storage file inventory
//    - Backup API calls
//    - All buttons and logic
//
//  What remains:
//    - Clean, minimal placeholder page
//    - Sidebar menu item still visible
// ============================================================================

"use client";

import { PageHeader } from "../ui";
import { Card, CardContent } from "@/components/ui/card";
import { Database, Clock } from "lucide-react";

export function BackupsView() {
  return (
    <div>
      <PageHeader
        title="Backup Management"
        description="Backup and restore functionality will be available in a future update."
      />

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Database className="size-8" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">
            Coming Soon
          </h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            The backup management system is being redesigned. This section will
            provide automated database backups, file storage backups, and
            one-click restore capabilities in a future release.
          </p>
          <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="size-3.5" />
            <span>Scheduled for a future phase</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
