'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import {
  listCropCycles,
  markCropHarvested,
  upsertCropCycle,
  type CropCycleRow,
} from '@/lib/supabase/crop-cycles';
import {
  CROP_CYCLE_GUIDE_DISCLAIMER,
  CROP_GUIDE_ENTRIES,
  CATEGORY_LABELS,
  filterCropGuide,
  suggestCycleDates,
  lookupCropGuide,
  type CropGuideCategory,
  type CropGuideEntry,
  type SeasonTag,
} from '@/lib/crop-cycle-guide';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageTransition } from '@/components/common/PageTransition';
import { formatTallyDate } from '@/lib/tally-format';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ChevronRight, Info, Pencil, Sprout } from 'lucide-react';

const SEASONS_DB = ['ALL', 'KHARIF', 'RABI', 'ZAID'] as const;
const SEASONS_SELECT: SeasonTag[] = ['KHARIF', 'RABI', 'ZAID'];

type CycleSeasonFilter = (typeof SEASONS_DB)[number];
type GuideSeasonFilter = SeasonTag | 'ALL';

export default function CropCyclesPage() {
  const { session } = useAuth();
  const dealerRowId = session?.dealerRowId ?? '';
  const dealerSlug = session?.dealerId ?? '';
  const { farmers } = useData();
  const qc = useQueryClient();

  const [seasonFilter, setSeasonFilter] = useState<CycleSeasonFilter>('ALL');
  const [guideSearch, setGuideSearch] = useState('');
  const [guideCategory, setGuideCategory] = useState<CropGuideCategory | 'ALL'>('ALL');
  const [guideSeason, setGuideSeason] = useState<GuideSeasonFilter>('ALL');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<CropCycleRow | null>(null);
  const [presetGuide, setPresetGuide] = useState<{ key: string; season: SeasonTag } | null>(null);

  const myFarmers = useMemo(
    () => farmers.filter((f) => f.dealerId === dealerSlug),
    [farmers, dealerSlug],
  );

  const q = useQuery({
    queryKey: ['crop-cycles', dealerRowId, seasonFilter],
    queryFn: () => listCropCycles(dealerRowId, seasonFilter === 'ALL' ? null : seasonFilter),
    enabled: !!dealerRowId,
  });

  const todayPlus7 = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  }, []);

  const upcoming = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return (q.data ?? []).filter(
      (r) => r.status === 'ACTIVE' && r.expected_harvest >= today && r.expected_harvest <= todayPlus7,
    );
  }, [q.data, todayPlus7]);

  const filteredGuide = useMemo(
    () =>
      filterCropGuide({
        search: guideSearch,
        category: guideCategory,
        season: guideSeason,
      }),
    [guideSearch, guideCategory, guideSeason],
  );

  const farmerLabelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of myFarmers) m.set(f.id, f.fullName);
    return m;
  }, [myFarmers]);

  const openNewDialog = () => {
    setEditingRow(null);
    setPresetGuide(null);
    setDialogOpen(true);
  };

  const openEditDialog = (row: CropCycleRow) => {
    setEditingRow(row);
    setPresetGuide(null);
    setDialogOpen(true);
  };

  const openFromGuide = (entry: CropGuideEntry, season: SeasonTag) => {
    setEditingRow(null);
    setPresetGuide({ key: entry.key, season });
    setDialogOpen(true);
  };

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['crop-cycles'] });

  return (
    <PageTransition>
      <div className="relative mx-auto max-w-5xl space-y-4 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold">Crop cycles</h1>
            <p className="text-sm text-muted-foreground">
              Track farmer cycles and browse indicative sowing calendars (India).
            </p>
          </div>
          <Button size="sm" onClick={openNewDialog} disabled={!dealerRowId || !myFarmers.length}>
            New crop cycle
          </Button>
        </div>

        {!myFarmers.length && dealerSlug ? (
          <Card className="border-dashed">
            <CardContent className="flex items-start gap-2 py-3 text-sm text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              Register farmers first to attach crop cycles to them.
            </CardContent>
          </Card>
        ) : null}

        <Card className="border-muted bg-muted/20">
          <CardContent className="flex gap-2 py-3 text-xs text-muted-foreground leading-snug">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-foreground/70" />
            <span>{CROP_CYCLE_GUIDE_DISCLAIMER}</span>
          </CardContent>
        </Card>

        <Tabs defaultValue="guide" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="guide" className="gap-1.5">
              <Sprout className="h-3.5 w-3.5" />
              Crop guide
            </TabsTrigger>
            <TabsTrigger value="cycles">My cycles</TabsTrigger>
          </TabsList>

          <TabsContent value="guide" className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder="Search crop (e.g. wheat, tamatar)…"
                value={guideSearch}
                onChange={(e) => setGuideSearch(e.target.value)}
                className="max-w-xs flex-1 min-w-[160px]"
              />
              <Select
                value={guideCategory}
                onValueChange={(v) => setGuideCategory(v as CropGuideCategory | 'ALL')}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All categories</SelectItem>
                  {(Object.keys(CATEGORY_LABELS) as CropGuideCategory[]).map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={guideSeason} onValueChange={(v) => setGuideSeason(v as GuideSeasonFilter)}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Season" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All seasons</SelectItem>
                  <SelectItem value="KHARIF">Kharif</SelectItem>
                  <SelectItem value="RABI">Rabi</SelectItem>
                  <SelectItem value="ZAID">Zaid</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              {filteredGuide.map((entry) => (
                <GuideCropCard key={entry.key} entry={entry} onUseCycle={openFromGuide} />
              ))}
              {!filteredGuide.length ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No crops match filters.</p>
              ) : null}
            </div>
          </TabsContent>

          <TabsContent value="cycles" className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              {SEASONS_DB.map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={seasonFilter === s ? 'default' : 'outline'}
                  onClick={() => setSeasonFilter(s)}
                >
                  {s}
                </Button>
              ))}
            </div>

            {upcoming.length ? (
              <Card className="border-warning/40 bg-warning/5">
                <CardHeader className="pb-1">
                  <CardTitle className="text-sm">Upcoming harvests (7 days)</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {upcoming.length} active cycle(s)
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">All cycles</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Farmer</th>
                      <th className="px-3 py-2">Crop</th>
                      <th className="px-3 py-2">Season</th>
                      <th className="px-3 py-2">Sowing</th>
                      <th className="px-3 py-2">Harvest (exp)</th>
                      <th className="px-3 py-2">Harvest (act)</th>
                      <th className="px-3 py-2">Area</th>
                      <th className="px-3 py-2">Plot / notes</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {(q.data ?? []).map((r) => (
                      <CropRow
                        key={r.id}
                        row={r}
                        farmerLabel={farmerLabelById.get(r.farmer_id) ?? r.farmer_id.slice(0, 12)}
                        onHarvested={invalidate}
                        onEdit={() => openEditDialog(r)}
                      />
                    ))}
                    {!q.data?.length && !q.isLoading ? (
                      <tr>
                        <td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">
                          No crop cycles yet — add one from the guide or here.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <CycleFormDialog
          open={dialogOpen}
          onOpenChange={(o) => {
            setDialogOpen(o);
            if (!o) {
              setEditingRow(null);
              setPresetGuide(null);
            }
          }}
          dealerRowId={dealerRowId}
          farmers={myFarmers}
          editingRow={editingRow}
          presetGuide={presetGuide}
          onSaved={() => {
            invalidate();
            toast.success(editingRow ? 'Cycle updated' : 'Cycle saved');
          }}
        />
      </div>
    </PageTransition>
  );
}

function GuideCropCard({
  entry,
  onUseCycle,
}: {
  entry: CropGuideEntry;
  onUseCycle: (e: CropGuideEntry, s: SeasonTag) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-muted/40"
      >
        <ChevronRight className={cn('h-4 w-4 shrink-0 transition-transform', open && 'rotate-90')} />
        <span className="font-medium">{entry.displayName}</span>
        {entry.displayNameHi ? (
          <span className="text-muted-foreground">({entry.displayNameHi})</span>
        ) : null}
        <span className="ml-auto rounded-full border bg-muted/50 px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
          {CATEGORY_LABELS[entry.category]}
        </span>
      </button>
      {open ? (
        <CardContent className="border-t bg-muted/10 px-4 pb-4 pt-3 space-y-3 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Seasons & sowing</p>
            <ul className="mt-1 space-y-1">
              {entry.seasons.map((s) => (
                <li key={`${entry.key}-${s.season}`} className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-background px-1.5 py-0.5 text-xs font-medium">{s.season}</span>
                  <span className="text-muted-foreground">{s.sowingLabel}</span>
                  <span className="text-xs text-muted-foreground">
                    (~{s.approxHarvestDaysMin}–{s.approxHarvestDaysMax} days to harvest)
                  </span>
                  <Button type="button" variant="outline" size="sm" className="ml-auto h-7 text-xs"
                    onClick={() => onUseCycle(entry, s.season)}>
                    Use in cycle
                  </Button>
                </li>
              ))}
            </ul>
          </div>
          {entry.transplantNote ? (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Transplant / nursery:</span> {entry.transplantNote}
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Best practices</p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-muted-foreground">
                {entry.bestPractices.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Common problems</p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-muted-foreground">
                {entry.commonProblems.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      ) : null}
    </Card>
  );
}

function CropRow({
  row,
  farmerLabel,
  onHarvested,
  onEdit,
}: {
  row: CropCycleRow;
  farmerLabel: string;
  onHarvested: () => void;
  onEdit: () => void;
}) {
  const snippet = [row.plot_location, row.notes].filter(Boolean).join(' · ');
  const notesClip = snippet.length > 48 ? `${snippet.slice(0, 48)}…` : snippet;

  return (
    <tr className="border-b border-border/60">
      <td className="px-3 py-2">{farmerLabel}</td>
      <td className="px-3 py-2">{row.crop_name}</td>
      <td className="px-3 py-2">{row.season}</td>
      <td className="px-3 py-2 tabular-nums text-muted-foreground">
        {row.sowing_date ? formatTallyDate(row.sowing_date) : '—'}
      </td>
      <td className="px-3 py-2 tabular-nums">{formatTallyDate(row.expected_harvest)}</td>
      <td className="px-3 py-2 tabular-nums text-muted-foreground">
        {row.actual_harvest ? formatTallyDate(row.actual_harvest) : '—'}
      </td>
      <td className="px-3 py-2 tabular-nums">
        {row.plot_area_acres != null ? Number(row.plot_area_acres).toFixed(2) : '—'}
      </td>
      <td className="max-w-[140px] truncate px-3 py-2 text-xs text-muted-foreground" title={snippet}>
        {notesClip || '—'}
      </td>
      <td className="px-3 py-2">{row.status}</td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onEdit}>
            <Pencil className="h-3 w-3" />
          </Button>
          {row.status === 'ACTIVE' ? (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() =>
                void markCropHarvested(row.id)
                  .then(onHarvested)
                  .catch(() => toast.error('Update failed'))
              }
            >
              Harvested
            </Button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function CycleFormDialog({
  open,
  onOpenChange,
  dealerRowId,
  farmers,
  editingRow,
  presetGuide,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealerRowId: string;
  farmers: { id: string; fullName: string }[];
  editingRow: CropCycleRow | null;
  presetGuide: { key: string; season: SeasonTag } | null;
  onSaved: () => void;
}) {
  const [farmerId, setFarmerId] = useState('');
  const [cropSelect, setCropSelect] = useState<string>('__other__');
  const [customCrop, setCustomCrop] = useState('');
  const [season, setSeason] = useState<SeasonTag>('RABI');
  const [sowingDate, setSowingDate] = useState('');
  const [expectedHarvest, setExpectedHarvest] = useState('');
  const [plotAcres, setPlotAcres] = useState('');
  const [plotLocation, setPlotLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const applyGuideDates = useCallback((entry: CropGuideEntry, sea: SeasonTag) => {
    const { sowing, harvest } = suggestCycleDates(entry, sea);
    setSowingDate(sowing);
    setExpectedHarvest(harvest);
  }, []);

  useEffect(() => {
    if (!open) return;

    if (editingRow) {
      setFarmerId(editingRow.farmer_id);
      const hit = lookupCropGuide(editingRow.crop_name);
      if (hit) {
        setCropSelect(hit.key);
        setCustomCrop('');
      } else {
        setCropSelect('__other__');
        setCustomCrop(editingRow.crop_name);
      }
      setSeason(editingRow.season as SeasonTag);
      setSowingDate(editingRow.sowing_date ?? '');
      setExpectedHarvest(editingRow.expected_harvest);
      setPlotAcres(editingRow.plot_area_acres != null ? String(editingRow.plot_area_acres) : '');
      setPlotLocation(editingRow.plot_location ?? '');
      setNotes(editingRow.notes ?? '');
      return;
    }

    setFarmerId(farmers[0]?.id ?? '');
    setNotes('');
    setPlotLocation('');
    setPlotAcres('');

    if (presetGuide) {
      const entry = CROP_GUIDE_ENTRIES.find((e) => e.key === presetGuide.key);
      if (entry) {
        setCropSelect(entry.key);
        setCustomCrop('');
        setSeason(presetGuide.season);
        applyGuideDates(entry, presetGuide.season);
        return;
      }
    }

    setCropSelect('wheat');
    setCustomCrop('');
    setSeason('RABI');
    const w = CROP_GUIDE_ENTRIES.find((e) => e.key === 'wheat');
    if (w) applyGuideDates(w, 'RABI');
  }, [open, editingRow, presetGuide, farmers, applyGuideDates]);

  const onCropOrSeasonChange = (nextCrop: string, nextSeason: SeasonTag) => {
    if (editingRow) return;
    if (nextCrop === '__other__') return;
    const entry = CROP_GUIDE_ENTRIES.find((e) => e.key === nextCrop);
    if (entry) applyGuideDates(entry, nextSeason);
  };

  const submit = async () => {
    const cropName =
      cropSelect === '__other__'
        ? customCrop.trim()
        : CROP_GUIDE_ENTRIES.find((e) => e.key === cropSelect)?.displayName ?? customCrop.trim();

    if (!farmerId || !cropName || !expectedHarvest) {
      toast.error('Farmer, crop, and expected harvest are required');
      return;
    }

    setSaving(true);
    try {
      await upsertCropCycle(dealerRowId, {
        id: editingRow?.id,
        farmer_id: farmerId,
        crop_name: cropName,
        season,
        sowing_date: sowingDate || null,
        expected_harvest: expectedHarvest,
        plot_area_acres: plotAcres.trim() ? Number(plotAcres) : null,
        plot_location: plotLocation.trim() || null,
        notes: notes.trim() || null,
        status: editingRow?.status ?? 'ACTIVE',
      });
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingRow ? 'Edit crop cycle' : 'New crop cycle'}</DialogTitle>
          <DialogDescription>
            Dates from the guide are suggestions — adjust for your farmer&apos;s field situation.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          <div className="grid gap-2">
            <Label htmlFor="ccf-farmer">Farmer</Label>
            <Select value={farmerId} onValueChange={setFarmerId}>
              <SelectTrigger id="ccf-farmer">
                <SelectValue placeholder="Select farmer" />
              </SelectTrigger>
              <SelectContent>
                {farmers.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Crop (guide)</Label>
            <Select
              value={cropSelect}
              onValueChange={(v) => {
                setCropSelect(v);
                if (v !== '__other__') onCropOrSeasonChange(v, season);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Crop" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {CROP_GUIDE_ENTRIES.map((e) => (
                  <SelectItem key={e.key} value={e.key}>
                    {e.displayName}
                    {e.displayNameHi ? ` (${e.displayNameHi})` : ''}
                  </SelectItem>
                ))}
                <SelectItem value="__other__">Other (custom)</SelectItem>
              </SelectContent>
            </Select>
            {cropSelect === '__other__' ? (
              <Input
                placeholder="Crop name"
                value={customCrop}
                onChange={(e) => setCustomCrop(e.target.value)}
              />
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label>Season</Label>
            <Select
              value={season}
              onValueChange={(v) => {
                const sea = v as SeasonTag;
                setSeason(sea);
                onCropOrSeasonChange(cropSelect, sea);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEASONS_SELECT.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-2">
              <Label htmlFor="ccf-sowing">Sowing date</Label>
              <Input
                id="ccf-sowing"
                type="date"
                value={sowingDate}
                onChange={(e) => setSowingDate(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ccf-harvest">Expected harvest</Label>
              <Input
                id="ccf-harvest"
                type="date"
                value={expectedHarvest}
                onChange={(e) => setExpectedHarvest(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-2">
              <Label htmlFor="ccf-acres">Area (acres)</Label>
              <Input
                id="ccf-acres"
                inputMode="decimal"
                placeholder="Optional"
                value={plotAcres}
                onChange={(e) => setPlotAcres(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ccf-loc">Plot / village block</Label>
              <Input
                id="ccf-loc"
                placeholder="Optional"
                value={plotLocation}
                onChange={(e) => setPlotLocation(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="ccf-notes">Notes</Label>
            <Textarea
              id="ccf-notes"
              rows={3}
              placeholder="Variety, irrigation, pest notes…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={saving || !dealerRowId}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
