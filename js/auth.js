/**
 * GitHub OAuth认证处理
 */
class Auth {
    constructor() {
        // GitHub OAuth应用的客户端ID
        // 注意：这里需要替换为你自己的GitHub OAuth应用的客户端ID
        this.clientId = 'Ov23liQxmJZhBqM3arPS';
        
        // 回调URL，需要与GitHub OAuth应用设置一致
        this.redirectUri = `${window.location.origin}/admin-callback.html`;
        
        // 请求的权限范围
        this.scope = 'repo';
        
        // 用户信息
        this.user = null;
        
        // 初始化
        this.init();
    }
    
    /**
     * 初始化认证
     */
    init() {
        // 存储客户端ID供回调页面使用
        localStorage.setItem('github_client_id', this.clientId);
        
        // 检查是否已登录
        this.checkAuth();
        
        // 绑定登录和登出事件
        document.getElementById('login-link')?.addEventListener('click', () => this.login());
        document.getElementById('logout-link')?.addEventListener('click', () => this.logout());
        document.getElementById('github-login')?.addEventListener('click', () => this.login());
    }
    
    /**
     * 启动GitHub OAuth登录流程
     */
    login() {
        // 生成随机state参数防止CSRF攻击
        const state = Math.random().toString(36).substring(2, 15);
        localStorage.setItem('oauth_state', state);
        
        // 构建GitHub OAuth授权URL
        const authUrl = `https://github.com/login/oauth/authorize?client_id=${this.clientId}&redirect_uri=${encodeURIComponent(this.redirectUri)}&scope=${this.scope}&state=${state}`;
        
        // 重定向到GitHub授权页面
        window.location.href = authUrl;
    }
    
    /**
     * 检查是否已认证
     */
    async checkAuth() {
        try {
            const token = this.getToken();
            
            if (!token) {
                this.showLoginUI();
                return false;
            }
            
            // 验证令牌有效性并获取用户信息
            const userInfo = await this.getUserInfo(token);
            
            if (!userInfo || userInfo.error) {
                this.logout();
                return false;
            }
            
            this.user = userInfo;
            this.showLoggedInUI();
            return true;
        } catch (error) {
            console.error('认证检查失败:', error);
            this.showLoginUI();
            return false;
        }
    }
    
    /**
     * 获取GitHub用户信息
     */
    async getUserInfo(token) {
        try {
            const response = await fetch('https://api.github.com/user', {
                headers: {
                    'Authorization': `token ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`GitHub API错误: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('获取用户信息失败:', error);
            return null;
        }
    }
    
    /**
     * 登出
     */
    logout() {
        localStorage.removeItem('github_token');
        this.user = null;
        this.showLoginUI();
        
        // 显示登出成功提示
        this.showToast('已成功登出', 'success');
    }
    
    /**
     * 获取访问令牌
     */
    getToken() {
        const encryptedToken = localStorage.getItem('github_token');
        if (!encryptedToken) return null;
        
        // 简单解密令牌
        try {
            return atob(encryptedToken);
        } catch (e) {
            console.error('令牌解密失败');
            return null;
        }
    }
    
    /**
     * 显示登录UI
     */
    showLoginUI() {
        document.getElementById('login-container')?.classList.remove('d-none');
        document.getElementById('posts-container')?.classList.add('d-none');
        document.getElementById('editor-container')?.classList.add('d-none');
        
        document.getElementById('login-item')?.classList.remove('d-none');
        document.getElementById('user-item')?.classList.add('d-none');
        document.getElementById('logout-item')?.classList.add('d-none');
    }
    
    /**
     * 显示已登录UI
     */
    showLoggedInUI() {
        document.getElementById('login-container')?.classList.add('d-none');
        document.getElementById('posts-container')?.classList.remove('d-none');
        
        document.getElementById('login-item')?.classList.add('d-none');
        document.getElementById('user-item')?.classList.remove('d-none');
        document.getElementById('logout-item')?.classList.remove('d-none');
        
        // 显示用户名
        if (this.user && this.user.login) {
            document.getElementById('username').textContent = this.user.login;
        }
    }
    
    /**
     * 显示提示消息
     */
    showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) return;
        
        const toastId = `toast-${Date.now()}`;
        const toast = document.createElement('div');
        toast.className = `toast align-items-center text-white bg-${type} border-0`;
        toast.id = toastId;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        toast.setAttribute('aria-atomic', 'true');
        
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        `;
        
        toastContainer.appendChild(toast);
        
        const bsToast = new bootstrap.Toast(toast, {
            autohide: true,
            delay: 3000
        });
        
        bsToast.show();
        
        // 自动移除
        toast.addEventListener('hidden.bs.toast', () => {
            toast.remove();
        });
    }
}

// 创建全局认证实例
const auth = new Auth();