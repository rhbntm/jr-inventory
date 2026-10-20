"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Users, UserPlus, Trash2 } from "lucide-react";
import { useUsers, useInviteUser, useUpdateUserRole, useRemoveUser } from "@/lib/hooks";
import { inviteUserSchema } from "@/lib/schemas";
import type { PublicUser } from "@/app/repositories/userRepo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Role = "OWNER" | "PARTNER";

const EMPTY_INVITE = { email: "", name: "", role: "PARTNER" as Role, password: "" };

function SignInMethods({ user }: { user: PublicUser }) {
  const hasGoogle = user.providers.includes("google");
  if (!hasGoogle && !user.hasPassword) {
    // Invited for Google but hasn't signed in yet
    return <Badge variant="outline">Invite pending</Badge>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {hasGoogle && <Badge variant="secondary">Google</Badge>}
      {user.hasPassword && <Badge variant="secondary">Password</Badge>}
    </div>
  );
}

export function UsersCard({ currentUserId }: { currentUserId?: string }) {
  const { data: users, isLoading } = useUsers();
  const inviteUser = useInviteUser();
  const updateRole = useUpdateUserRole();
  const removeUser = useRemoveUser();

  const [invite, setInvite] = useState(EMPTY_INVITE);
  const [userToRemove, setUserToRemove] = useState<PublicUser | null>(null);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = inviteUserSchema.safeParse(invite);
    if (!result.success) {
      toast.error(result.error.issues[0].message);
      return;
    }
    try {
      const user = await inviteUser.mutateAsync(result.data);
      toast.success(
        user.hasPassword
          ? `${user.email} can now sign in`
          : `${user.email} invited. They can sign in with Google.`
      );
      setInvite(EMPTY_INVITE);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to invite user");
    }
  };

  const handleRoleChange = async (user: PublicUser, role: Role) => {
    if (role === user.role) return;
    try {
      await updateRole.mutateAsync({ id: user.id, data: { role } });
      toast.success(`${user.name} is now ${role === "OWNER" ? "an owner" : "a partner"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change role");
    }
  };

  const handleRemove = async () => {
    if (!userToRemove) return;
    try {
      await removeUser.mutateAsync(userToRemove.id);
      toast.success(`${userToRemove.email} no longer has access`);
      setUserToRemove(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove user");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Users
        </CardTitle>
        <CardDescription>
          Only people listed here can sign in. Invite someone by their Gmail address and they can
          sign in with Google. Add a password only if they need email/password sign-in.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Invite form */}
        <form onSubmit={handleInvite} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Email *</Label>
            <Input
              id="invite-email"
              type="email"
              value={invite.email}
              onChange={(e) => setInvite((s) => ({ ...s, email: e.target.value }))}
              placeholder="name@gmail.com"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-name">Name *</Label>
            <Input
              id="invite-name"
              value={invite.name}
              onChange={(e) => setInvite((s) => ({ ...s, name: e.target.value }))}
              placeholder="Juan Dela Cruz"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select
              value={invite.role}
              onValueChange={(v) => setInvite((s) => ({ ...s, role: (v as Role) ?? "PARTNER" }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PARTNER">Partner</SelectItem>
                <SelectItem value="OWNER">Owner</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-password">Password (optional)</Label>
            <Input
              id="invite-password"
              type="password"
              autoComplete="new-password"
              value={invite.password}
              onChange={(e) => setInvite((s) => ({ ...s, password: e.target.value }))}
              placeholder="Leave empty for Google only"
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={inviteUser.isPending} className="w-full sm:w-auto">
              <UserPlus className="mr-2 h-4 w-4" />
              {inviteUser.isPending ? "Inviting..." : "Invite user"}
            </Button>
          </div>
        </form>

        {/* User list */}
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Sign-in</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((user) => {
                  const isSelf = user.id === currentUserId;
                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="font-medium">
                          {user.name}
                          {isSelf && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}
                        </div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      </TableCell>
                      <TableCell>
                        <SignInMethods user={user} />
                      </TableCell>
                      <TableCell>
                        {isSelf ? (
                          // Owners can't demote themselves, so there's always at least one owner.
                          <Badge>{user.role === "OWNER" ? "Owner" : "Partner"}</Badge>
                        ) : (
                          <Select
                            value={user.role}
                            onValueChange={(v) => v && handleRoleChange(user, v as Role)}
                            disabled={updateRole.isPending}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PARTNER">Partner</SelectItem>
                              <SelectItem value="OWNER">Owner</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell>
                        {!isSelf && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Remove ${user.email}`}
                            onClick={() => setUserToRemove(user)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={userToRemove !== null} onOpenChange={(open) => !open && setUserToRemove(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {userToRemove?.name}?</DialogTitle>
            <DialogDescription>
              {userToRemove?.email} will be signed out and can no longer sign in. Stock movements
              they recorded stay in the history.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserToRemove(null)} disabled={removeUser.isPending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemove} disabled={removeUser.isPending}>
              {removeUser.isPending ? "Removing..." : "Remove access"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
