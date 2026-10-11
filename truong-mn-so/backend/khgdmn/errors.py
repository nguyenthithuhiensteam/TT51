class AppError(Exception):
    """Lỗi nghiệp vụ trả về cho giao diện dưới dạng {"error": message} (giống handler() của bản Node)."""

    def __init__(self, message: str, http_status: int = 400):
        super().__init__(message)
        self.message = message
        self.http_status = http_status
