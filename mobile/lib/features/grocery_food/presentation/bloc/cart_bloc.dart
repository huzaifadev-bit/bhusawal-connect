import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable';
import '../../domain/entities/product.dart';

// Events
abstract class CartEvent extends Equatable {
  const CartEvent();
  @override
  List<Object> get props => [];
}

class AddProductEvent extends CartEvent {
  final Product product;
  const AddProductEvent(this.product);

  @override
  List<Object> get props => [product];
}

class RemoveProductEvent extends CartEvent {
  final Product product;
  const RemoveProductEvent(this.product);

  @override
  List<Object> get props => [product];
}

// State
class CartState extends Equatable {
  final List<Product> items;
  final double total;

  const CartState({required this.items, required this.total});

  factory CartState.initial() => const CartState(items: [], total: 0.0);

  @override
  List<Object> get props => [items, total];
}

// BLoC
class CartBloc extends Bloc<CartEvent, CartState> {
  CartBloc() : super(CartState.initial()) {
    on<AddProductEvent>((event, emit) {
      final updated = List<Product>.from(state.items)..add(event.product);
      final newTotal = state.total + event.product.price;
      emit(CartState(items: updated, total: newTotal));
    });

    on<RemoveProductEvent>((event, emit) {
      final updated = List<Product>.from(state.items)..remove(event.product);
      final newTotal = state.total - event.product.price;
      emit(CartState(items: updated, total: newTotal >= 0 ? newTotal : 0));
    });
  }
}
