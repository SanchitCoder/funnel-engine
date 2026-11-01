"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { PeopleTable } from "@/components/people-table";
import { Card } from "@/components/ui/card";

export default function PeoplePage() {
  return (
    <Suspense>
      <PeopleView />
    </Suspense>
  );
}

function PeopleView() {
  const params = useSearchParams();
  const w = Number(params.get("webinar"));
  return (
    <>
      <PageHeader
        eyebrow="People"
        title="Everyone who ever registered"
        description="Search across every webinar. Open a person to see their whole journey, from the first reminder to the payment. Repeat attendees are flagged."
      />
      <Card>
        <PeopleTable showWebinarFilter initialWebinarId={Number.isFinite(w) && w > 0 ? w : undefined} exportName="people" pageSize={20} />
      </Card>
    </>
  );
}
