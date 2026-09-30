import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/api/authService';
import { LoginCredentials, ChangePasswordPayload } from '@/types';

export const useAuth = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, isLoading, setCredentials, clearCredentials } = useAuthStore();

  const loginMutation = useMutation({
    mutationFn: (credentials: LoginCredentials) => authApi.login(credentials),
    onSuccess: (data) => {
      setCredentials(data.user, data.tokens);
      queryClient.setQueryData(['currentUser'], data.user);
      navigate('/dashboard', { replace: true });
    },
  });

  const meQuery = useQuery({
    queryKey: ['currentUser'],
    queryFn: authApi.getMe,
    enabled: isAuthenticated && !user,
    staleTime: 5 * 60 * 1000,
  });

  const changePasswordMutation = useMutation({
    mutationFn: (payload: ChangePasswordPayload) => authApi.changePassword(payload),
  });

  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      clearCredentials();
      queryClient.clear();
      navigate('/login', { replace: true });
    }
  };

  return {
    user: user || meQuery.data || null,
    isAuthenticated,
    isLoading: isLoading || loginMutation.isPending || meQuery.isLoading,
    login: loginMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    loginError: loginMutation.error,
    changePassword: changePasswordMutation.mutateAsync,
    isChangingPassword: changePasswordMutation.isPending,
    changePasswordError: changePasswordMutation.error,
    logout,
  };
};
