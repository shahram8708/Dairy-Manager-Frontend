import os
from flask import Flask, render_template
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'frontend-secret')
API_BASE_URL = os.environ.get('API_BASE_URL', 'http://127.0.0.1:5000/api/v1')

@app.context_processor
def inject_api_url():
    return {'api_base_url': API_BASE_URL}

@app.route('/')
@app.route('/login')
def login():
    return render_template('login.html')

@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

@app.route('/agencies')
def agencies():
    return render_template('agencies.html')

@app.route('/products')
def products():
    return render_template('products.html')

@app.route('/dealers')
def dealers():
    return render_template('dealers.html')

@app.route('/dealers/<int:dealer_id>')
def dealer_profile(dealer_id):
    return render_template('dealer_profile.html', dealer_id=dealer_id)

@app.route('/delivery-entry')
def delivery_entry():
    return render_template('delivery_entry.html')

@app.route('/payment-collection')
def payment_collection():
    return render_template('payment_collection.html')

@app.route('/reports/daily-sheet')
def report_daily_sheet():
    return render_template('reports/daily_sheet.html')

@app.route('/reports/dealer-statement')
def report_dealer_statement():
    return render_template('reports/dealer_statement.html')

@app.route('/reports/outstanding')
def report_outstanding():
    return render_template('reports/outstanding.html')

@app.route('/reports/product-sales')
def report_product_sales():
    return render_template('reports/product_sales.html')

@app.route('/reports/payment-collection')
def report_payment_collection():
    return render_template('reports/payment_collection.html')

@app.route('/users')
def users():
    return render_template('users.html')

@app.route('/settings')
def settings():
    return render_template('settings.html')

@app.errorhandler(404)
def page_not_found(e):
    return render_template('404.html'), 404

@app.errorhandler(500)
def server_error(e):
    return render_template('500.html'), 500

if __name__ == '__main__':
    app.run(
        host='0.0.0.0',
        port=3000,
        debug=os.environ.get('DEBUG', 'False').lower() in ('true', '1'),
        use_reloader=False
    )
