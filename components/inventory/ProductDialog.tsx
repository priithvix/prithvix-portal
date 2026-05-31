'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ItemCategory, ItemUnit, InventoryBaseUnit } from '@/constants/types';
import { Save, X } from 'lucide-react';

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (productData: ProductData, skuData: SKUData) => void;
  initialData?: {
    product?: Partial<ProductData>;
    sku?: Partial<SKUData>;
  };
}

export interface ProductData {
  productName: string;
  category: ItemCategory;
  baseUnit: InventoryBaseUnit;
  gstPercent: number;
  companyName?: string;
  hsnCode?: string;
  // Pesticide fields
  technicalName?: string;
  formulation?: string;
  cibRegNumber?: string;
  // Seed fields
  cropName?: string;
  variety?: string;
  seedClass?: string;
}

export interface SKUData {
  displayLabel: string;
  unitType: ItemUnit;
  unitsPerBase: number;
  sellingPriceExGst?: number;
  mrp?: number;
  batchNumber?: string;
  manufacturingDate?: string;
  expiryDate?: string;
  lotNumber?: string;
  germinationPercent?: number;
  germinationValidUpto?: string;
  leadTimeDays: number;
}

export default function ProductDialog({ open, onOpenChange, onSave, initialData }: ProductDialogProps) {
  const [category, setCategory] = useState<ItemCategory>('fertilizer');
  
  // Product fields
  const [productName, setProductName] = useState('');
  const [baseUnit, setBaseUnit] = useState<InventoryBaseUnit>('kg');
  const [gstPercent, setGstPercent] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [hsnCode, setHsnCode] = useState('');
  
  // Pesticide fields
  const [technicalName, setTechnicalName] = useState('');
  const [formulation, setFormulation] = useState('');
  const [cibRegNumber, setCibRegNumber] = useState('');
  
  // Seed fields
  const [cropName, setCropName] = useState('');
  const [variety, setVariety] = useState('');
  const [seedClass, setSeedClass] = useState('');
  
  // SKU fields
  const [displayLabel, setDisplayLabel] = useState('');
  const [unitType, setUnitType] = useState<ItemUnit>('kg');
  const [unitsPerBase, setUnitsPerBase] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [mrp, setMrp] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [manufacturingDate, setManufacturingDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [germinationPercent, setGerminationPercent] = useState('');
  const [germinationValidUpto, setGerminationValidUpto] = useState('');
  const [leadTimeDays, setLeadTimeDays] = useState('7');

  useEffect(() => {
    if (initialData?.product) {
      const p = initialData.product;
      if (p.productName) setProductName(p.productName);
      if (p.category) setCategory(p.category);
      if (p.baseUnit) setBaseUnit(p.baseUnit);
      if (p.gstPercent) setGstPercent(p.gstPercent.toString());
      if (p.companyName) setCompanyName(p.companyName);
      if (p.hsnCode) setHsnCode(p.hsnCode);
      if (p.technicalName) setTechnicalName(p.technicalName);
      if (p.formulation) setFormulation(p.formulation);
      if (p.cibRegNumber) setCibRegNumber(p.cibRegNumber);
      if (p.cropName) setCropName(p.cropName);
      if (p.variety) setVariety(p.variety);
      if (p.seedClass) setSeedClass(p.seedClass);
    }
    
    if (initialData?.sku) {
      const s = initialData.sku;
      if (s.displayLabel) setDisplayLabel(s.displayLabel);
      if (s.unitType) setUnitType(s.unitType);
      if (s.unitsPerBase) setUnitsPerBase(s.unitsPerBase.toString());
      if (s.sellingPriceExGst) setSellingPrice(s.sellingPriceExGst.toString());
      if (s.mrp) setMrp(s.mrp.toString());
      if (s.batchNumber) setBatchNumber(s.batchNumber);
      if (s.manufacturingDate) setManufacturingDate(s.manufacturingDate);
      if (s.expiryDate) setExpiryDate(s.expiryDate);
      if (s.lotNumber) setLotNumber(s.lotNumber);
      if (s.germinationPercent) setGerminationPercent(s.germinationPercent.toString());
      if (s.germinationValidUpto) setGerminationValidUpto(s.germinationValidUpto);
      if (s.leadTimeDays) setLeadTimeDays(s.leadTimeDays.toString());
    }
  }, [initialData, open]);

  const handleSubmit = () => {
    if (!productName || !gstPercent || !displayLabel || !unitsPerBase) {
      alert('Please fill in all required fields');
      return;
    }

    const productData: ProductData = {
      productName,
      category,
      baseUnit,
      gstPercent: parseFloat(gstPercent),
      companyName: companyName || undefined,
      hsnCode: hsnCode || undefined,
      technicalName: technicalName || undefined,
      formulation: formulation || undefined,
      cibRegNumber: cibRegNumber || undefined,
      cropName: cropName || undefined,
      variety: variety || undefined,
      seedClass: seedClass || undefined,
    };

    const skuData: SKUData = {
      displayLabel,
      unitType,
      unitsPerBase: parseFloat(unitsPerBase),
      sellingPriceExGst: sellingPrice ? parseFloat(sellingPrice) : undefined,
      mrp: mrp ? parseFloat(mrp) : undefined,
      batchNumber: batchNumber || undefined,
      manufacturingDate: manufacturingDate || undefined,
      expiryDate: expiryDate || undefined,
      lotNumber: lotNumber || undefined,
      germinationPercent: germinationPercent ? parseFloat(germinationPercent) : undefined,
      germinationValidUpto: germinationValidUpto || undefined,
      leadTimeDays: parseInt(leadTimeDays) || 7,
    };

    onSave(productData, skuData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Product & SKU</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="details">Product Details</TabsTrigger>
            <TabsTrigger value="batch">Batch & SKU</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4 pt-4">
            <div>
              <Label htmlFor="productName">Product Name *</Label>
              <Input
                id="productName"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="e.g., DAP, Urea, BT Cotton Seed"
                className="mt-1.5"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="category">Category *</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as ItemCategory)}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fertilizer">Fertilizer</SelectItem>
                    <SelectItem value="pesticide">Pesticide</SelectItem>
                    <SelectItem value="insecticide">Insecticide</SelectItem>
                    <SelectItem value="seeds">Seeds</SelectItem>
                    <SelectItem value="others">Others</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="baseUnit">Base Unit *</Label>
                <Select value={baseUnit} onValueChange={(v) => setBaseUnit(v as InventoryBaseUnit)}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">Kilograms (kg)</SelectItem>
                    <SelectItem value="litre">Litres (L)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="gst">GST % *</Label>
                <Input
                  id="gst"
                  type="number"
                  value={gstPercent}
                  onChange={(e) => setGstPercent(e.target.value)}
                  placeholder="18"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="hsnCode">HSN Code</Label>
                <Input
                  id="hsnCode"
                  value={hsnCode}
                  onChange={(e) => setHsnCode(e.target.value)}
                  placeholder="3102"
                  className="mt-1.5"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="companyName">Company/Brand Name</Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g., IFFCO, Coromandel, UPL"
                className="mt-1.5"
              />
            </div>
          </TabsContent>

          <TabsContent value="details" className="space-y-4 pt-4">
            {(category === 'pesticide' || category === 'insecticide') && (
              <>
                <div>
                  <Label htmlFor="technicalName">Technical Name</Label>
                  <Input
                    id="technicalName"
                    value={technicalName}
                    onChange={(e) => setTechnicalName(e.target.value)}
                    placeholder="e.g., Acephate 75% SP"
                    className="mt-1.5"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="formulation">Formulation</Label>
                    <Select value={formulation} onValueChange={setFormulation}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Select formulation" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SP">SP (Soluble Powder)</SelectItem>
                        <SelectItem value="WP">WP (Wettable Powder)</SelectItem>
                        <SelectItem value="EC">EC (Emulsifiable Concentrate)</SelectItem>
                        <SelectItem value="SL">SL (Soluble Liquid)</SelectItem>
                        <SelectItem value="SC">SC (Suspension Concentrate)</SelectItem>
                        <SelectItem value="WG">WG (Water Dispersible Granules)</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="cibReg">CIB Registration No.</Label>
                    <Input
                      id="cibReg"
                      value={cibRegNumber}
                      onChange={(e) => setCibRegNumber(e.target.value)}
                      placeholder="CIB/####/####"
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </>
            )}

            {category === 'seeds' && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="cropName">Crop Name</Label>
                    <Input
                      id="cropName"
                      value={cropName}
                      onChange={(e) => setCropName(e.target.value)}
                      placeholder="e.g., Wheat, Cotton, Rice"
                      className="mt-1.5"
                    />
                  </div>

                  <div>
                    <Label htmlFor="variety">Variety</Label>
                    <Input
                      id="variety"
                      value={variety}
                      onChange={(e) => setVariety(e.target.value)}
                      placeholder="e.g., HD-2967, BG-II"
                      className="mt-1.5"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="seedClass">Seed Class</Label>
                  <Select value={seedClass} onValueChange={setSeedClass}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Select seed class" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Foundation">Foundation Seed</SelectItem>
                      <SelectItem value="Certified">Certified Seed</SelectItem>
                      <SelectItem value="Truthfully Labelled">Truthfully Labelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {category === 'fertilizer' && (
              <div className="py-8 text-center text-muted-foreground">
                <p>No additional details required for fertilizers.</p>
                <p className="text-sm mt-1">You can add batch details in the next tab.</p>
              </div>
            )}

            {category === 'others' && (
              <div className="py-8 text-center text-muted-foreground">
                <p>No additional details required for this category.</p>
                <p className="text-sm mt-1">You can add batch details in the next tab.</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="batch" className="space-y-4 pt-4">
            <div>
              <Label htmlFor="displayLabel">SKU Label / Pack Size *</Label>
              <Input
                id="displayLabel"
                value={displayLabel}
                onChange={(e) => setDisplayLabel(e.target.value)}
                placeholder="e.g., 50 kg Bag, 1 L Bottle"
                className="mt-1.5"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="unitType">Unit Type *</Label>
                <Select value={unitType} onValueChange={(v) => setUnitType(v as ItemUnit)}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">Kilogram</SelectItem>
                    <SelectItem value="litre">Litre</SelectItem>
                    <SelectItem value="packet">Packet</SelectItem>
                    <SelectItem value="bag">Bag</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="unitsPerBase">Units Per Base *</Label>
                <Input
                  id="unitsPerBase"
                  type="number"
                  value={unitsPerBase}
                  onChange={(e) => setUnitsPerBase(e.target.value)}
                  placeholder="50"
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {baseUnit === 'kg' ? 'kg per pack' : 'litres per pack'}
                </p>
              </div>

              <div>
                <Label htmlFor="leadTime">Lead Time (days)</Label>
                <Input
                  id="leadTime"
                  type="number"
                  value={leadTimeDays}
                  onChange={(e) => setLeadTimeDays(e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="sellingPrice">Selling Price (Ex-GST)</Label>
                <Input
                  id="sellingPrice"
                  type="number"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  placeholder="1200"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="mrp">MRP (Inc-GST)</Label>
                <Input
                  id="mrp"
                  type="number"
                  value={mrp}
                  onChange={(e) => setMrp(e.target.value)}
                  placeholder="1416"
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="batchNumber">Batch Number</Label>
                <Input
                  id="batchNumber"
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  placeholder="BATCH123456"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="lotNumber">Lot Number {category === 'seeds' && '(Seed)'}</Label>
                <Input
                  id="lotNumber"
                  value={lotNumber}
                  onChange={(e) => setLotNumber(e.target.value)}
                  placeholder="LOT789"
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="mfgDate">Manufacturing Date (MM/YYYY)</Label>
                <Input
                  id="mfgDate"
                  type="month"
                  value={manufacturingDate}
                  onChange={(e) => setManufacturingDate(e.target.value)}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="expDate">Expiry Date (MM/YYYY)</Label>
                <Input
                  id="expDate"
                  type="month"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>

            {category === 'seeds' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="germination">Germination %</Label>
                  <Input
                    id="germination"
                    type="number"
                    value={germinationPercent}
                    onChange={(e) => setGerminationPercent(e.target.value)}
                    placeholder="85"
                    max="100"
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label htmlFor="germValid">Germination Valid Upto</Label>
                  <Input
                    id="germValid"
                    type="month"
                    value={germinationValidUpto}
                    onChange={(e) => setGerminationValidUpto(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            <Save className="mr-2 h-4 w-4" />
            Save Product
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
