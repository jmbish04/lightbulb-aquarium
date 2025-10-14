// Client-side JavaScript for Jobseeker Orchestrator

// Global state
window.JobseekerOrchestrator = {
    apiBase: '',
    currentRunId: null,
    wsConnection: null,
    errorContainer: null
};

// Utility functions
const Utils = {
    // Format date/time
    formatDateTime: function(timestamp) {
        return new Date(timestamp).toLocaleString();
    },
    
    // Format relative time
    formatRelativeTime: function(timestamp) {
        const now = new Date();
        const time = new Date(timestamp);
        const diff = now - time;
        
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
        if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        return 'Just now';
    },
    
    // Show notification
    showNotification: function(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 z-50 p-4 rounded-md shadow-lg max-w-sm ${this.getNotificationClass(type)}`;
        notification.innerHTML = `
            <div class="flex">
                <div class="flex-shrink-0">
                    ${this.getNotificationIcon(type)}
                </div>
                <div class="ml-3">
                    <p class="text-sm font-medium">${message}</p>
                </div>
                <div class="ml-auto pl-3">
                    <button onclick="this.parentElement.parentElement.remove()" class="text-gray-400 hover:text-gray-600">
                        <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    },

    // Show error in dedicated error container
    showError: function(message, details = null, containerId = 'errorContainer') {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('Error container not found:', containerId);
            this.showNotification(message, 'error');
            return;
        }

        // Clear existing errors
        this.clearErrors(containerId);

        const errorHtml = `
            <div class="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
                <div class="flex">
                    <div class="flex-shrink-0">
                        <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                        </svg>
                    </div>
                    <div class="ml-3 flex-1">
                        <h3 class="text-sm font-medium text-red-800">Error</h3>
                        <div class="mt-2 text-sm text-red-700">
                            <p>${message}</p>
                            ${details ? `<details class="mt-2"><summary class="cursor-pointer font-medium">Technical Details</summary><pre class="mt-2 text-xs bg-red-100 p-2 rounded overflow-x-auto">${details}</pre></details>` : ''}
                        </div>
                        <div class="mt-3">
                            <button onclick="Utils.clearErrors('${containerId}')" class="text-sm bg-red-100 text-red-800 px-3 py-1 rounded hover:bg-red-200">
                                Dismiss
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = errorHtml;
        container.classList.remove('hidden');
    },

    // Clear errors from container
    clearErrors: function(containerId = 'errorContainer') {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = '';
            container.classList.add('hidden');
        }
    },

    // Show success message
    showSuccess: function(message, containerId = 'successContainer') {
        const container = document.getElementById(containerId);
        if (!container) {
            this.showNotification(message, 'success');
            return;
        }

        this.clearErrors(containerId);

        const successHtml = `
            <div class="bg-green-50 border border-green-200 rounded-md p-4 mb-4">
                <div class="flex">
                    <div class="flex-shrink-0">
                        <svg class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                        </svg>
                    </div>
                    <div class="ml-3">
                        <h3 class="text-sm font-medium text-green-800">Success</h3>
                        <div class="mt-2 text-sm text-green-700">
                            <p>${message}</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = successHtml;
        container.classList.remove('hidden');
    },

    // Show loading state
    showLoading: function(message = 'Loading...', containerId = 'loadingContainer') {
        const container = document.getElementById(containerId);
        if (!container) return;

        const loadingHtml = `
            <div class="flex items-center justify-center py-8">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span class="ml-3 text-gray-600">${message}</span>
            </div>
        `;

        container.innerHTML = loadingHtml;
        container.classList.remove('hidden');
    },

    // Hide loading state
    hideLoading: function(containerId = 'loadingContainer') {
        const container = document.getElementById(containerId);
        if (container) {
            container.classList.add('hidden');
        }
    },
    
    getNotificationClass: function(type) {
        const classes = {
            'success': 'bg-green-50 border border-green-200 text-green-800',
            'error': 'bg-red-50 border border-red-200 text-red-800',
            'warning': 'bg-yellow-50 border border-yellow-200 text-yellow-800',
            'info': 'bg-blue-50 border border-blue-200 text-blue-800'
        };
        return classes[type] || classes.info;
    },
    
    getNotificationIcon: function(type) {
        const icons = {
            'success': '<svg class="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>',
            'error': '<svg class="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path></svg>',
            'warning': '<svg class="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>',
            'info': '<svg class="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path></svg>'
        };
        return icons[type] || icons.info;
    },
    
    // Debounce function
    debounce: function(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    // Throttle function
    throttle: function(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
};

// API client with enhanced error handling
const API = {
    baseUrl: '',
    
    // Make API request with comprehensive error handling
    request: async function(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };
        
        try {
            // Show loading state if container exists
            Utils.showLoading('Loading...', 'loadingContainer');
            
            const response = await fetch(url, config);
            
            // Hide loading state
            Utils.hideLoading('loadingContainer');
            
            if (!response.ok) {
                let errorMessage = `Request failed with status ${response.status}`;
                let errorDetails = null;
                
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.message || errorData.error || errorMessage;
                    errorDetails = errorData.details || null;
                } catch (e) {
                    // If response is not JSON, use status text
                    errorMessage = response.statusText || errorMessage;
                }
                
                throw new APIError(errorMessage, response.status, errorDetails);
            }
            
            return await response.json();
        } catch (error) {
            // Hide loading state
            Utils.hideLoading('loadingContainer');
            
            if (error instanceof APIError) {
                throw error;
            }
            
            // Handle network errors
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new APIError('Network error: Unable to connect to server. Please check your internet connection and try again.', 'NETWORK_ERROR', error.message);
            }
            
            // Handle other errors
            throw new APIError('An unexpected error occurred. Please try again.', 'UNKNOWN_ERROR', error.message);
        }
    },
    
    // GET request
    get: function(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    },
    
    // POST request
    post: function(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },
    
    // PUT request
    put: function(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },
    
    // DELETE request
    delete: function(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }
};

// Custom API Error class
class APIError extends Error {
    constructor(message, code, details = null) {
        super(message);
        this.name = 'APIError';
        this.code = code;
        this.details = details;
    }
}

// Form handling with enhanced error display
const FormHandler = {
    // Serialize form data
    serialize: function(form) {
        const formData = new FormData(form);
        const data = {};
        
        for (let [key, value] of formData.entries()) {
            if (data[key]) {
                // Handle multiple values (like checkboxes)
                if (Array.isArray(data[key])) {
                    data[key].push(value);
                } else {
                    data[key] = [data[key], value];
                }
            } else {
                data[key] = value;
            }
        }
        
        return data;
    },
    
    // Validate form
    validate: function(form, rules = {}) {
        const errors = {};
        const formData = this.serialize(form);
        
        for (const [field, rule] of Object.entries(rules)) {
            const value = formData[field];
            
            if (rule.required && (!value || value.length === 0)) {
                errors[field] = `${rule.label || field} is required`;
            }
            
            if (rule.pattern && value && !rule.pattern.test(value)) {
                errors[field] = rule.message || `${rule.label || field} format is invalid`;
            }
            
            if (rule.minLength && value && value.length < rule.minLength) {
                errors[field] = `${rule.label || field} must be at least ${rule.minLength} characters`;
            }
            
            if (rule.maxLength && value && value.length > rule.maxLength) {
                errors[field] = `${rule.label || field} must be no more than ${rule.maxLength} characters`;
            }
        }
        
        return errors;
    },
    
    // Show form errors
    showErrors: function(form, errors) {
        // Clear previous errors
        form.querySelectorAll('.error-message').forEach(el => el.remove());
        form.querySelectorAll('.border-red-500').forEach(el => {
            el.classList.remove('border-red-500');
            el.classList.add('border-gray-300');
        });
        
        // Show new errors
        for (const [field, message] of Object.entries(errors)) {
            const input = form.querySelector(`[name="${field}"]`);
            if (input) {
                input.classList.add('border-red-500');
                input.classList.remove('border-gray-300');
                
                const errorDiv = document.createElement('div');
                errorDiv.className = 'error-message text-red-500 text-sm mt-1';
                errorDiv.textContent = message;
                input.parentNode.appendChild(errorDiv);
            }
        }
    },

    // Handle form submission with error handling
    handleSubmit: async function(form, submitHandler, validationRules = {}) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Clear previous errors
            Utils.clearErrors('errorContainer');
            Utils.clearErrors('successContainer');
            
            // Validate form
            const errors = FormHandler.validate(form, validationRules);
            if (Object.keys(errors).length > 0) {
                FormHandler.showErrors(form, errors);
                Utils.showError('Please correct the errors below and try again.');
                return;
            }
            
            try {
                await submitHandler(form);
            } catch (error) {
                console.error('Form submission error:', error);
                
                if (error instanceof APIError) {
                    Utils.showError(error.message, error.details);
                } else {
                    Utils.showError('An unexpected error occurred. Please try again.', error.message);
                }
            }
        });
    }
};

// WebSocket client with error handling
const WebSocketClient = {
    connection: null,
    reconnectAttempts: 0,
    maxReconnectAttempts: 5,
    reconnectDelay: 1000,
    
    connect: function(url) {
        return new Promise((resolve, reject) => {
            try {
                this.connection = new WebSocket(url);
                
                this.connection.onopen = () => {
                    console.log('WebSocket connected');
                    this.reconnectAttempts = 0;
                    resolve(this.connection);
                };
                
                this.connection.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    reject(new Error('Failed to connect to monitoring service. Please check your connection and try again.'));
                };
                
                this.connection.onclose = (event) => {
                    console.log('WebSocket disconnected:', event.code, event.reason);
                    
                    // Attempt to reconnect if not a normal closure
                    if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
                        this.reconnectAttempts++;
                        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
                        
                        setTimeout(() => {
                            this.connect(url).catch(console.error);
                        }, this.reconnectDelay * this.reconnectAttempts);
                    } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                        Utils.showError('Connection lost. Please refresh the page to reconnect.');
                    }
                };
                
                this.connection.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        if (window.handleWebSocketMessage) {
                            window.handleWebSocketMessage(data);
                        }
                    } catch (error) {
                        console.error('Error parsing WebSocket message:', error);
                        Utils.showError('Error processing live updates. Some features may not work correctly.');
                    }
                };
                
            } catch (error) {
                reject(new Error('WebSocket is not supported in this browser. Please use a modern browser.'));
            }
        });
    },
    
    disconnect: function() {
        if (this.connection) {
            this.connection.close(1000, 'User disconnected');
            this.connection = null;
        }
    },
    
    send: function(data) {
        if (this.connection && this.connection.readyState === WebSocket.OPEN) {
            try {
                this.connection.send(JSON.stringify(data));
            } catch (error) {
                console.error('Error sending WebSocket message:', error);
                Utils.showError('Failed to send message. Connection may be lost.');
            }
        } else {
            Utils.showError('Not connected to monitoring service. Please refresh the page.');
        }
    }
};

// Export for global use
window.Utils = Utils;
window.API = API;
window.APIError = APIError;
window.FormHandler = FormHandler;
window.WebSocketClient = WebSocketClient;