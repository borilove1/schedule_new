// API 통신 유틸리티
const API_BASE_URL = process.env.REACT_APP_API_URL || '/api/v1';

class ApiClient {
  constructor() {
    this.token = localStorage.getItem('token');
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const config = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || data.message || '요청 실패');
      }

      // { success: true, data: {...} } 형태면 data만 반환
      return data.success && data.data ? data.data : data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // 인증
  async login(email, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(data.token);
    return data;
  }

  async register(userData) {
    const data = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    // 관리자 승인 필요 - 토큰 저장하지 않음
    return data;
  }

  async logout() {
    await this.request('/auth/logout', { method: 'POST' });
    this.setToken(null);
  }

  async getCurrentUser() {
    return this.request('/auth/me');
  }

  async updateMyProfile(data) {
    return this.request('/auth/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async changePassword(currentPassword, newPassword) {
    return this.request('/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  // 일정
  async getEvents(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/events${query ? `?${query}` : ''}`);
  }

  async getEvent(id) {
    const response = await this.request(`/events/${id}`);
    // response는 { event: {...} } 형태
    // event 객체를 반환
    return response?.event || response;
  }

  async createEvent(eventData) {
    return this.request('/events', {
      method: 'POST',
      body: JSON.stringify(eventData),
    });
  }

  async updateEvent(id, eventData) {
    return this.request(`/events/${id}`, {
      method: 'PUT',
      body: JSON.stringify(eventData),
    });
  }

  async deleteEvent(id, options = {}) {
    return this.request(`/events/${id}`, {
      method: 'DELETE',
      body: JSON.stringify(options),
    });
  }

  async completeEvent(id, options = {}) {
    return this.request(`/events/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  async uncompleteEvent(id) {
    return this.request(`/events/${id}/uncomplete`, {
      method: 'POST',
    });
  }

  async searchEvents(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/events/search${query ? `?${query}` : ''}`);
  }

  // ========== 사용자 관리 (Admin) ==========
  async getUsers(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/users${query ? `?${query}` : ''}`);
  }

  async getUserDetail(id) {
    return this.request(`/users/${id}`);
  }

  async updateUser(id, userData) {
    return this.request(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }

  async toggleUserActive(id) {
    return this.request(`/users/${id}/toggle-active`, {
      method: 'PATCH',
    });
  }

  async deleteUser(id) {
    return this.request(`/users/${id}`, {
      method: 'DELETE',
    });
  }

  async approveUser(id) {
    return this.request(`/users/${id}/approve`, {
      method: 'PATCH',
    });
  }

  async getPendingApprovalCount() {
    return this.request('/users/pending-count');
  }

  // ========== 조직 관리 (Admin) ==========
  async getOffices(divisionId) {
    const query = divisionId ? `?divisionId=${divisionId}` : '';
    return this.request(`/organizations/offices${query}`);
  }

  async createDivision(name) {
    return this.request('/organizations/divisions', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async updateDivision(id, name) {
    return this.request(`/organizations/divisions/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
  }

  async deleteDivision(id) {
    return this.request(`/organizations/divisions/${id}`, {
      method: 'DELETE',
    });
  }

  async createOffice(name, divisionId) {
    return this.request('/organizations/offices', {
      method: 'POST',
      body: JSON.stringify({ name, divisionId }),
    });
  }

  async updateOffice(id, data) {
    return this.request(`/organizations/offices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteOffice(id) {
    return this.request(`/organizations/offices/${id}`, {
      method: 'DELETE',
    });
  }

  async createDepartment(name, officeId) {
    return this.request('/organizations/departments', {
      method: 'POST',
      body: JSON.stringify({ name, officeId }),
    });
  }

  async updateDepartment(id, data) {
    return this.request(`/organizations/departments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteDepartment(id) {
    return this.request(`/organizations/departments/${id}`, {
      method: 'DELETE',
    });
  }

  // ========== 시스템 설정 (Admin) ==========
  async getSettings() {
    return this.request('/settings');
  }

  async updateSettings(settings) {
    return this.request('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  async sendTestEmail() {
    return this.request('/settings/test-email', {
      method: 'POST',
    });
  }

  // ========== 이메일 알림 설정 ==========
  async getEmailPreferences() {
    return this.request('/auth/email-preferences');
  }

  async updateEmailPreferences(prefs) {
    return this.request('/auth/email-preferences', {
      method: 'PUT',
      body: JSON.stringify(prefs),
    });
  }

  // 댓글
  async getEventComments(eventId) {
    return this.request(`/comments/events/${eventId}`);
  }

  async getSeriesComments(seriesId) {
    return this.request(`/comments/series/${seriesId}`);
  }

  async addEventComment(eventId, content) {
    return this.request(`/comments/events/${eventId}`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  async addSeriesComment(seriesId, content) {
    return this.request(`/comments/series/${seriesId}`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  async updateComment(commentId, content) {
    return this.request(`/comments/${commentId}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });
  }

  async deleteComment(commentId) {
    return this.request(`/comments/${commentId}`, {
      method: 'DELETE',
    });
  }

  // 현황판
  async getDashboardStats(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/events/dashboard/stats${query ? `?${query}` : ''}`);
  }

  // 조직 구조
  async getOrganizations() {
    return this.request('/organizations/structure');
  }

  async getDivisions() {
    return this.request('/organizations/divisions');
  }

  async getDepartments() {
    return this.request('/organizations/departments');
  }

  // Notifications
  async getNotifications(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/notifications${query ? `?${query}` : ''}`);
  }

  async getUnreadNotificationCount() {
    return this.request('/notifications/unread-count');
  }

  async markNotificationAsRead(id) {
    return this.request(`/notifications/${id}/read`, {
      method: 'PATCH',
    });
  }

  async markAllNotificationsAsRead() {
    return this.request('/notifications/read-all', {
      method: 'POST',
    });
  }

  async deleteNotification(id) {
    return this.request(`/notifications/${id}`, {
      method: 'DELETE',
    });
  }
}

export const api = new ApiClient();
export default api;
