'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PageTransition } from '@/components/common/PageTransition';
import { EmptyState } from '@/components/common/EmptyState';
import { Users, UserPlus, Trash2, Shield, Phone, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function StaffManagementPage() {
  const { staff, addStaff, toggleStaff, deleteStaff, isAddingStaff, isDealer } = useAuth();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    username: '',
    password: '',
  });

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      username: '',
      password: '',
    });
  };

  // Handle add staff
  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addStaff(formData);
      toast.success('Staff member added successfully');
      setAddDialogOpen(false);
      resetForm();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add staff member');
    }
  };

  // Handle toggle active
  const handleToggleActive = async (staffId: string) => {
    try {
      await toggleStaff(staffId);
      const member = staff.find((s) => s.id === staffId);
      toast.success(`Staff member ${member?.isActive ? 'deactivated' : 'activated'}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update staff status');
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!selectedStaff) return;
    try {
      await deleteStaff(selectedStaff);
      toast.success('Staff member deleted successfully');
      setDeleteDialogOpen(false);
      setSelectedStaff(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete staff member');
    }
  };

  // Only dealers can manage staff
  if (!isDealer) {
    return (
      <PageTransition>
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <div className="text-center">
            <Shield className="mx-auto h-12 w-12 text-muted-foreground" />
            <h1 className="mt-4 text-2xl font-bold text-foreground">Access Restricted</h1>
            <p className="mt-2 text-muted-foreground">
              Only the dealer owner can manage staff members
            </p>
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="space-y-6 p-4 lg:p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Staff Management
            </h1>
            <p className="mt-1 text-muted-foreground">
              Manage staff accounts and permissions
            </p>
          </div>
          <Button onClick={() => setAddDialogOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add Staff
          </Button>
        </div>

        {/* Stats Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <div className="text-sm font-medium text-muted-foreground">Total Staff</div>
                <div className="mt-1 text-2xl font-bold">{staff.length}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Active</div>
                <div className="mt-1 text-2xl font-bold text-success">
                  {staff.filter((s) => s.isActive).length}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Inactive</div>
                <div className="mt-1 text-2xl font-bold text-muted-foreground">
                  {staff.filter((s) => !s.isActive).length}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Staff List */}
        <Card>
          <CardHeader>
            <CardTitle>Staff Members</CardTitle>
          </CardHeader>
          <CardContent>
            {staff.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No staff members"
                description="Add your first staff member to get started"
                action={{
                  label: 'Add Staff Member',
                  onClick: () => setAddDialogOpen(true),
                }}
              />
            ) : (
              <div className="space-y-4">
                {staff.map((member) => (
                  <div
                    key={member.id}
                    className={cn(
                      'flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors',
                      !member.isActive && 'opacity-50'
                    )}
                  >
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Users className="h-5 w-5" />
                      </div>

                      {/* Details */}
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{member.name}</h3>
                          <Badge variant={member.isActive ? 'default' : 'secondary'}>
                            {member.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <div className="mt-1 flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:gap-4">
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {member.phone}
                          </div>
                          <div className="flex items-center gap-1">
                            <Lock className="h-3 w-3" />
                            @{member.username}
                          </div>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Added {format(new Date(member.createdAt), 'dd MMM yyyy')}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`active-${member.id}`} className="text-xs">
                          Active
                        </Label>
                        <Switch
                          id={`active-${member.id}`}
                          checked={member.isActive}
                          onCheckedChange={() => handleToggleActive(member.id)}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedStaff(member.id);
                          setDeleteDialogOpen(true);
                        }}
                        className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add Staff Dialog */}
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Staff Member</DialogTitle>
              <DialogDescription>
                Create a new staff account. They can log in using their username and password.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddStaff}>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    placeholder="Enter full name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="10-digit mobile number"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    placeholder="Choose a username"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Choose a strong password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setAddDialogOpen(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isAddingStaff}>
                  {isAddingStaff ? 'Adding...' : 'Add Staff'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Staff Member</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this staff member? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageTransition>
  );
}
